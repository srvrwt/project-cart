import { useEffect, useState } from "react";
import { useLoaderData, useFetcher, useNavigate } from "react-router";
import prisma from "../db.server";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
    await authenticate.admin(request);
    const projects = await prisma.project.findMany({
        orderBy: { createdAt: "desc" },
        include: {
            items: true
        }
    });

    const projectsWithStats = projects.map(project => {
        const totalQty = project.items.reduce((sum, item) => sum + (item.quantity || 0), 0);

        return {
            ...project,
            totalQty
        };
    });

    return { projects: projectsWithStats };
};

export default function ProjectsPage() {
    const { projects } = useLoaderData();
    const fetcher = useFetcher();
    const navigate = useNavigate();
    const [name, setName] = useState("");
    const [editId, setEditId] = useState(null);
    const [editName, setEditName] = useState("");

    const isLoading = fetcher.state !== "idle";

    useEffect(() => {
        if (fetcher.state === "idle" && fetcher.data) {
            if (fetcher.data.project && !editId) {
                setName("");
            }
            if (fetcher.data.success || (fetcher.data.project && editId)) {
                setEditId(null);
                setEditName("");
            }
        }
    }, [fetcher.state, fetcher.data, editId]);

    const handleAdd = () => {
        if (!name) return;
        fetcher.submit(
            { name },
            { method: "POST", action: "/api/project/create", encType: "application/json" }
        );
    };

    const handleUpdate = () => {
        if (!editName) return;
        fetcher.submit(
            { id: editId, name: editName },
            { method: "POST", action: "/api/project/update", encType: "application/json" }
        );
    };

    const handleDelete = (id) => {
        if (!confirm("Are you sure you want to delete this project?")) return;
        fetcher.submit(
            { id },
            { method: "POST", action: "/api/project/delete", encType: "application/json" }
        );
    };

    return (
        <s-page heading="Projects">
            <s-section heading="All Projects">
                <s-stack direction="block" gap="base">
                    <s-box padding="base" borderWidth="base" borderRadius="base" background="subdued">
                        <s-stack direction="inline" gap="base" align="center" justifyContent="space-between">
                            <s-text-field
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Enter project name"
                            >
                            </s-text-field>
                            <s-button icon="plus" onClick={handleAdd} {...(isLoading && !editId ? { loading: true } : {})}>Create Project</s-button>
                        </s-stack>
                    </s-box>

                    {projects.length === 0 ? (
                        <s-box padding="loose" textAlign="center">
                            <s-paragraph>No projects found. Create one to get started!</s-paragraph>
                        </s-box>
                    ) : (
                        <s-box borderWidth="base" borderRadius="base">
                            <s-table>
                                <s-table-header-row>
                                    <s-table-header listSlot="primary">Project Name</s-table-header>
                                    <s-table-header listSlot="inline">User ID</s-table-header>
                                    <s-table-header listSlot="labeled">Created</s-table-header>
                                    <s-table-header listSlot="labeled">Products</s-table-header>
                                    <s-table-header listSlot="labeled">Actions</s-table-header>
                                </s-table-header-row>

                                <s-table-body>
                                    {projects.map((p) => (
                                        <s-table-row key={p.id}>

                                            {/* Project Name */}
                                            <s-table-cell>
                                                {editId === p.id ? (
                                                    <s-text-field
                                                        value={editName}
                                                        onChange={(e) => setEditName(e.target.value)}
                                                    />
                                                ) : (
                                                    <s-link onClick={() => navigate(`/app/project/${p.id}`)}>
                                                        {p.name}
                                                    </s-link>
                                                )}
                                            </s-table-cell>

                                            {/* User ID */}
                                            <s-table-cell>
                                                <s-text tone="subdued">{p.userId || 'N/A'}</s-text>
                                            </s-table-cell>

                                            {/* Created */}
                                            <s-table-cell>
                                                <s-text tone="subdued">
                                                    {new Date(p.createdAt).toLocaleDateString()}
                                                </s-text>
                                            </s-table-cell>

                                            {/* Products */}
                                            <s-table-cell>
                                                <s-badge tone="success">{p.totalQty || 0}</s-badge>
                                            </s-table-cell>

                                            {/* Actions */}
                                            <s-table-cell>
                                                {editId === p.id ? (
                                                    <s-stack direction="inline" gap="base">
                                                        <s-button variant="secondary" onClick={() => setEditId(null)}>
                                                            Cancel
                                                        </s-button>

                                                        <s-button
                                                            variant="primary"
                                                            onClick={handleUpdate}
                                                            {...(isLoading ? { loading: true } : {})}
                                                        >
                                                            Save
                                                        </s-button>

                                                    </s-stack>
                                                ) : (
                                                    <s-stack direction="inline" gap="base">
                                                        <s-button
                                                            icon="edit"
                                                            onClick={() => { setEditId(p.id); setEditName(p.name); }}
                                                        >
                                                            Edit
                                                        </s-button>
                                                        <s-button
                                                            icon="delete"
                                                            tone="critical"
                                                            onClick={() => handleDelete(p.id)}
                                                        >
                                                            Delete
                                                        </s-button>
                                                    </s-stack>
                                                )}
                                            </s-table-cell>

                                        </s-table-row>
                                    ))}
                                </s-table-body>
                            </s-table>
                        </s-box>
                    )}
                </s-stack>
            </s-section>
        </s-page>
    );
}