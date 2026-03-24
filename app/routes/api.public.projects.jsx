import prisma from "../db.server";

export async function loader({ request }) {
    const projects = await prisma.project.findMany({
        orderBy: { createdAt: "desc" },
    });

    return new Response(JSON.stringify({ projects }), {
        headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*", // Allow cross-origin requests
            "Access-Control-Allow-Methods": "GET, OPTIONS",
        },
    });
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
