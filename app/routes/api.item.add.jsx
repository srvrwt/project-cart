import prisma from "../db.server";

export async function action({ request }) {
    // Handle OPTIONS request for CORS preflight
    if (request.method === "OPTIONS") {
        return new Response(null, {
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "POST, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type",
            },
        });
    }

    if (request.method !== "POST") {
        return new Response(JSON.stringify({ error: "Method not allowed" }), {
            status: 405,
            headers: { "Content-Type": "application/json" },
        });
    }

    try {
        const body = await request.json();
        
        // Extract with fallbacks for different casings/names
        const projectId = body.projectId || body.project_id;
        const variantId = body.variantId || body.variant_id;
        const quantity = body.quantity || body.qty || 1;
        const addedBy = body.addedBy || "External API";
        const userEmail = body.userEmail || body.userId;

        // Deep check for Area/area (check top level, then check inside 'properties' or 'itemProperties' if they exist)
        let area = body.area || body.Area;
        if (!area && body.properties) {
            area = body.properties.area || body.properties.Area;
        }
        if (!area && body.itemProperties) {
            area = body.itemProperties.area || body.itemProperties.Area;
        }

        if (!projectId || !variantId) {
            return new Response(JSON.stringify({ error: "projectId and variantId are required" }), {
                status: 400,
                headers: { 
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*",
                },
            });
        }

        // Optional: Update the project's userId if we have it now but it's missing in the DB
        if (userEmail) {
            await prisma.project.update({
                where: { id: projectId },
                data: { userId: String(userEmail) }
            }).catch(() => {});
        }

        const newItem = await prisma.item.create({
            data: {
                projectId,
                variantId,
                quantity: parseInt(quantity) || 1,
                area: area ? String(area).trim() : null,
                addedBy,
            },
        });

        return new Response(JSON.stringify({ item: newItem }), {
            headers: { 
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
            },
        });
    } catch (error) {
        console.error("Error adding item:", error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
            },
        });
    }
}

// Handle OPTIONS request if it's sent as a separate request
export async function loader() {
    return new Response(null, {
        headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
        },
    });
}
