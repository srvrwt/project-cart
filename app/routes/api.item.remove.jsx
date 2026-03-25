import prisma from "../db.server";

export async function action({ request }) {
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
        const { itemId, projectId, variantId } = body;

        // ── Path 1: direct itemId (existing admin usage) ──
        if (itemId) {
            await prisma.item.delete({ where: { id: itemId } });
            return new Response(JSON.stringify({ success: true }), {
                headers: {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*",
                },
            });
        }

        // ── Path 2: lookup by projectId + variantId (from Shopify storefront) ──
        if (projectId && variantId) {
            const cleanVariantId = String(variantId).replace("gid://shopify/ProductVariant/", "");

            await prisma.item.deleteMany({
                where: {
                    projectId,
                    variantId: {
                        in: [
                            cleanVariantId,
                            `gid://shopify/ProductVariant/${cleanVariantId}`
                        ]
                    }
                }
            });

            return new Response(JSON.stringify({ success: true }), {
                headers: {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*",
                },
            });
        }

        return new Response(
            JSON.stringify({ error: "itemId or (projectId + variantId) required" }),
            {
                status: 400,
                headers: {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*",
                },
            }
        );

    } catch (error) {
        console.error("Error removing item:", error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
            },
        });
    }
}

export async function loader() {
    return new Response(null, {
        headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
        },
    });
}