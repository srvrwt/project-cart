/**
 * useProjectCart.js
 *
 * Drop-in replacement for localStorage-based cart logic.
 * All data persists in Shopify metaobjects — accessible from any device.
 *
 * Metaobject schema (confirmed):
 *   project      → fields: project (name), user_id, created_at
 *   area         → fields: name, project (metaobject_reference GID)
 *   project_item → fields: product (product_reference GID), quantity, area (GID), project (GID)
 *
 * Usage:
 *   const cart = useProjectCart(userId);
 */

import { useState, useEffect, useCallback } from "react";

const fetchJSON = async (url, options = {}) => {
    const res = await fetch(url, {
        headers: { "Content-Type": "application/json" },
        ...options,
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Request failed ${res.status}: ${text}`);
    }
    return res.json();
};

export function useProjectCart(userId) {
    const [projects, setProjects] = useState([]);
    const [areas, setAreas] = useState({});   // { [projectId]: Area[] }
    const [items, setItems] = useState({});   // { [projectId|areaId]: Item[] }
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // ─── PROJECTS ──────────────────────────────────────────────────────────────

    const fetchProjects = useCallback(async () => {
        if (!userId) return;
        setLoading(true);
        setError(null);
        try {
            const data = await fetchJSON(
                `/api/project/list?userId=${encodeURIComponent(userId)}`
            );
            setProjects(data.projects ?? []);
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }, [userId]);

    useEffect(() => {
        fetchProjects();
    }, [fetchProjects]);

    /**
     * createProject(name: string) → { id, handle } | undefined
     */
    const createProject = useCallback(
        async (name) => {
            setLoading(true);
            setError(null);
            try {
                const data = await fetchJSON("/api/project/create", {
                    method: "POST",
                    body: JSON.stringify({ name, userId }),
                });
                const errors = data.data?.metaobjectCreate?.userErrors;
                if (errors?.length) throw new Error(errors.map((e) => e.message).join(", "));
                const created = data.data?.metaobjectCreate?.metaobject;
                if (created) await fetchProjects();
                return created;
            } catch (e) {
                setError(e.message);
            } finally {
                setLoading(false);
            }
        },
        [userId, fetchProjects]
    );

    /**
     * deleteProject(projectId: string) — projectId is the full GID
     */
    const deleteProject = useCallback(async (projectId) => {
        setLoading(true);
        setError(null);
        try {
            await fetchJSON("/api/project/delete", {
                method: "POST",
                body: JSON.stringify({ projectId }),
            });
            setProjects((prev) => prev.filter((p) => p.id !== projectId));
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }, []);

    // ─── AREAS ─────────────────────────────────────────────────────────────────

    /**
     * fetchAreas(projectId: string) — projectId is the full GID
     * Returns Area[]: { id, handle, name, projectId }
     */
    const fetchAreas = useCallback(async (projectId) => {
        setLoading(true);
        setError(null);
        try {
            const data = await fetchJSON(
                `/api/area/list?projectId=${encodeURIComponent(projectId)}`
            );
            const result = data.areas ?? [];
            setAreas((prev) => ({ ...prev, [projectId]: result }));
            return result;
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }, []);

    /**
     * createArea(name: string, projectId: string)
     * projectId must be the full GID: "gid://shopify/Metaobject/123"
     */
    const createArea = useCallback(
        async (name, projectId) => {
            setLoading(true);
            setError(null);
            try {
                const data = await fetchJSON("/api/area/create", {
                    method: "POST",
                    body: JSON.stringify({ name, projectId }),
                });
                const errors = data.data?.metaobjectCreate?.userErrors;
                if (errors?.length) throw new Error(errors.map((e) => e.message).join(", "));
                const created = data.data?.metaobjectCreate?.metaobject;
                if (created) await fetchAreas(projectId);
                return created;
            } catch (e) {
                setError(e.message);
            } finally {
                setLoading(false);
            }
        },
        [fetchAreas]
    );

    // ─── ITEMS ─────────────────────────────────────────────────────────────────

    /**
     * fetchItems({ projectId?, areaId? })
     * Returns Item[]: { id, handle, productId, areaId, projectId, quantity, product }
     * product = { id, title, imageUrl, price, currencyCode } (resolved from Shopify)
     */
    const fetchItems = useCallback(async ({ projectId, areaId } = {}) => {
        setLoading(true);
        setError(null);
        const params = new URLSearchParams();
        if (projectId) params.set("projectId", projectId);
        if (areaId) params.set("areaId", areaId);
        const cacheKey = areaId ?? projectId;

        try {
            const data = await fetchJSON(`/api/item/list?${params.toString()}`);
            const result = data.items ?? [];
            if (cacheKey) setItems((prev) => ({ ...prev, [cacheKey]: result }));
            return result;
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }, []);

    /**
     * addItem({ productId, quantity, areaId, projectId })
     * All IDs must be full GIDs:
     *   productId  → "gid://shopify/Product/123"
     *   areaId     → "gid://shopify/Metaobject/456"
     *   projectId  → "gid://shopify/Metaobject/789"
     */
    const addItem = useCallback(
        async ({ productId, quantity = 1, areaId, projectId }) => {
            setLoading(true);
            setError(null);
            try {
                const data = await fetchJSON("/api/item/add", {
                    method: "POST",
                    body: JSON.stringify({ productId, quantity, areaId, projectId }),
                });
                const errors = data.data?.metaobjectCreate?.userErrors;
                if (errors?.length) throw new Error(errors.map((e) => e.message).join(", "));
                const created = data.data?.metaobjectCreate?.metaobject;
                if (created) await fetchItems({ projectId, areaId });
                return created;
            } catch (e) {
                setError(e.message);
            } finally {
                setLoading(false);
            }
        },
        [fetchItems]
    );

    /**
     * updateQuantity(itemId: string, quantity: number, { projectId?, areaId? })
     */
    const updateQuantity = useCallback(
        async (itemId, quantity, { projectId, areaId } = {}) => {
            setLoading(true);
            setError(null);
            try {
                await fetchJSON("/api/item/remove", {
                    method: "POST",
                    body: JSON.stringify({ itemId, quantity }),
                });
                await fetchItems({ projectId, areaId });
            } catch (e) {
                setError(e.message);
            } finally {
                setLoading(false);
            }
        },
        [fetchItems]
    );

    /**
     * removeItem(itemId: string, { projectId?, areaId? })
     */
    const removeItem = useCallback(
        async (itemId, { projectId, areaId } = {}) => {
            setLoading(true);
            setError(null);
            try {
                await fetchJSON("/api/item/remove", {
                    method: "POST",
                    body: JSON.stringify({ itemId }),
                });
                const cacheKey = areaId ?? projectId;
                if (cacheKey) {
                    setItems((prev) => ({
                        ...prev,
                        [cacheKey]: (prev[cacheKey] ?? []).filter((i) => i.id !== itemId),
                    }));
                }
            } catch (e) {
                setError(e.message);
            } finally {
                setLoading(false);
            }
        },
        []
    );

    // ─── RETURN ────────────────────────────────────────────────────────────────

    return {
        // State
        projects,  // [{ id, handle, name, userId, createdAt }]
        areas,     // { [projectGID]: [{ id, handle, name, projectId }] }
        items,     // { [projectGID|areaGID]: [{ id, productId, quantity, product{...} }] }
        loading,
        error,

        // Project
        fetchProjects,
        createProject,
        deleteProject,

        // Area
        fetchAreas,
        createArea,

        // Item
        fetchItems,
        addItem,
        updateQuantity,
        removeItem,
    };
}