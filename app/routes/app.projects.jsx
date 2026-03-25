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
                        <s-stack direction="inline" gap="base" align="center">
                            <input
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Enter project name"
                                style={{
                                    flex: 1,
                                    padding: '8px',
                                    borderRadius: '4px',
                                    border: '1px solid #c9cccf',
                                    fontSize: '14px'
                                }}
                            />
                            <s-button icon="plus" onClick={handleAdd} {...(isLoading && !editId ? { loading: true } : {})}>Create Project</s-button>
                        </s-stack>
                    </s-box>

                    {projects.length === 0 ? (
                        <s-box padding="loose" textAlign="center">
                            <s-paragraph>No projects found. Create one to get started!</s-paragraph>
                        </s-box>
                    ) : (
                        <s-box borderWidth="base" borderRadius="base">
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ background: '#f6f6f7', borderBottom: '1px solid #e1e3e5' }}>
                                        <th style={{ textAlign: 'left', padding: '12px 16px', fontWeight: 'bold' }}>Project Name</th>
                                        <th style={{ textAlign: 'left', padding: '12px 16px', fontWeight: 'bold' }}>User ID</th>
                                        <th style={{ textAlign: 'left', padding: '12px 16px', fontWeight: 'bold' }}>Created</th>
                                        <th style={{ textAlign: 'center', padding: '12px 16px', fontWeight: 'bold' }}>Products</th>
                                        <th style={{ textAlign: 'right', padding: '12px 16px', fontWeight: 'bold' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {projects.map((p) => (
                                        <tr key={p.id} style={{ borderBottom: '1px solid #f1f2f3' }}>
                                            <td style={{ padding: '12px 16px' }}>
                                                {editId === p.id ? (
                                                    <input
                                                        value={editName}
                                                        onChange={(e) => setEditName(e.target.value)}
                                                        style={{
                                                            padding: '4px 8px',
                                                            borderRadius: '4px',
                                                            border: '1px solid #c9cccf',
                                                            width: '80%'
                                                        }}
                                                    />
                                                ) : (
                                                    <s-link onClick={() => navigate(`/app/project/${p.id}`)}>{p.name}</s-link>
                                                )}
                                            </td>
                                            <td style={{ padding: '12px 16px', color: '#6d7175', fontSize: '13px' }}>
                                                {p.userId || 'N/A'}
                                            </td>
                                            <td style={{ padding: '12px 16px', color: '#6d7175', fontSize: '13px' }}>
                                                {new Date(p.createdAt).toLocaleDateString()}
                                            </td>
                                            <td style={{ textAlign: 'center', padding: '12px 16px', fontWeight: '600', color: '#008060' }}>
                                                {p.totalQty || 0}
                                            </td>
                                            <td style={{ textAlign: 'right', padding: '12px 16px' }}>
                                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                                                    {editId === p.id ? (
                                                        <>
                                                            <s-button variant="primary" onClick={handleUpdate} {...(isLoading ? { loading: true } : {})}>Save</s-button>
                                                            <s-button variant="tertiary" onClick={() => setEditId(null)}>Cancel</s-button>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <s-button variant="tertiary" onClick={() => { setEditId(p.id); setEditName(p.name); }}>Edit</s-button>
                                                            <s-button variant="tertiary" onClick={() => handleDelete(p.id)} tone="critical">Delete</s-button>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </s-box>
                    )}
                </s-stack>
            </s-section>
        </s-page>
    );
}