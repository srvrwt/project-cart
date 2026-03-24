import prisma from "../db.server";

export async function loader({ request }) {
    const url = new URL(request.url);
    const projectId = url.searchParams.get("projectId");

    if (!projectId) {
        return new Response(JSON.stringify({ error: "projectId is required" }), {
            status: 400,
            headers: { 
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
            },
        });
    }

    try {
        const items = await prisma.item.findMany({
            where: { projectId },
            orderBy: { id: "desc" },
        });

        return new Response(JSON.stringify({ items }), {
            headers: { 
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
            },
        });
    } catch (error) {
        console.error("Error listing items:", error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
            },
        });
    }
}

// Handle OPTIONS request for CORS preflight
export async function action({ request }) {
    return new Response(null, {
        headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
        },
    });
}
