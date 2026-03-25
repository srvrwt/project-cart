import prisma from "../db.server";

export async function action({ request }) {
    // ── CORS preflight ──
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
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
            },
        });
    }

    try {
        const body = await request.json();
        const { projectId, variantId, quantity, area } = body;

        if (!projectId || !variantId || quantity === undefined) {
            return new Response(JSON.stringify({ error: "projectId, variantId and quantity required" }), {
                status: 400,
                headers: {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*",
                },
            });
        }

        const cleanVariantId = String(variantId).replace("gid://shopify/ProductVariant/", "");

        // Build the where clause
        const where = {
            projectId,
            variantId: {
                in: [
                    cleanVariantId,
                    `gid://shopify/ProductVariant/${cleanVariantId}`
                ]
            }
        };

        // If area is provided, use it to narrow down
        if (area) {
            where.area = area;
        }

        const updateResult = await prisma.item.updateMany({
            where,
            data: {
                quantity: parseInt(quantity)
            }
        });

        return new Response(JSON.stringify({ success: true, count: updateResult.count }), {
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
            },
        });

    } catch (error) {
        console.error("Error updating item:", error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
            },
        });
    }
}

// ── CORS preflight loader ──
export async function loader() {
    return new Response(null, {
        headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
        },
    });
}