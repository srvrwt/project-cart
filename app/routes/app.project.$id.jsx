import React, { useState, useMemo } from "react";
import { useLoaderData, useNavigate } from "react-router";
import db from "../db.server";
import { authenticate } from "../shopify.server";

export const loader = async ({ request, params }) => {
    const { admin } = await authenticate.admin(request);

    const project = await db.project.findUnique({
        where: { id: params.id },
        include: { items: true },
    });

    if (!project) {
        return { project: null };
    }

    // Fetch product details for each variantId
    const variantIds = [...new Set(project.items.map(item => {
        const vid = String(item.variantId);
        return vid.startsWith("gid://") ? vid : `gid://shopify/ProductVariant/${vid}`;
    }))];

    if (variantIds.length === 0) {
        return { project, itemsWithDetails: [] };
    }

    try {
        // GraphQL query to fetch multiple variants
        const response = await admin.graphql(
            `#graphql
            query getVariants($ids: [ID!]!) {
              nodes(ids: $ids) {
                ... on ProductVariant {
                  id
                  title
                  price
                  image {
                    url
                    altText
                  }
                  product {
                    title
                    featuredImage {
                      url
                      altText
                    }
                  }
                }
              }
            }`,
            {
                variables: {
                    ids: variantIds,
                },
            }
        );

        const data = await response.json();
        const variantNodes = data?.data?.nodes || [];

        // Map variant details back to project items
        const itemsWithDetails = project.items.map(item => {
            const itemVid = String(item.variantId).startsWith("gid://")
                ? item.variantId
                : `gid://shopify/ProductVariant/${item.variantId}`;

            const variant = variantNodes.find(v => v && v.id === itemVid);
            return {
                ...item,
                variantDetails: variant || null
            };
        });
        return { project, itemsWithDetails };
    } catch (error) {
        console.error("Error fetching variant details:", error);
        // Return project with items but no variant details as fallback
        return {
            project,
            itemsWithDetails: project.items.map(item => ({ ...item, variantDetails: null }))
        };
    }
};

export default function ProjectPage() {
    const { project, itemsWithDetails } = useLoaderData();
    const navigate = useNavigate();
    const [viewMode, setViewMode] = useState("area"); // "product", "area"

    const { processedItems, totalQty, totalPrice } = useMemo(() => {
        let items = [];
        let qty = 0;
        let price = 0;

        itemsWithDetails.forEach(item => {
            const p = parseFloat(item.variantDetails?.price || 0);
            qty += item.quantity;
            price += item.quantity * p;
        });

        if (viewMode === "product") {
            const grouped = {};
            itemsWithDetails.forEach(item => {
                const variantId = item.variantId;
                if (!grouped[variantId]) {
                    grouped[variantId] = {
                        ...item,
                        quantity: 0,
                        areaMap: {} // { "Lounge": 5, "Office": 10 }
                    };
                }
                grouped[variantId].quantity += item.quantity;
                const areaName = item.area || "Unassigned";
                grouped[variantId].areaMap[areaName] = (grouped[variantId].areaMap[areaName] || 0) + item.quantity;
            });

            items = Object.values(grouped).map(item => ({
                ...item,
                areaList: Object.entries(item.areaMap).map(([area, areaQty]) => `${area} (${areaQty})`)
            }));
        } else if (viewMode === "area") {
            const grouped = {};
            itemsWithDetails.forEach(item => {
                const areaKey = item.area || "Unassigned";
                if (!grouped[areaKey]) {
                    grouped[areaKey] = {
                        displayTitle: areaKey,
                        items: [],
                        totalQty: 0,
                        totalPrice: 0
                    };
                }
                grouped[areaKey].items.push(item);
                grouped[areaKey].totalQty += item.quantity;
                grouped[areaKey].totalPrice += item.quantity * parseFloat(item.variantDetails?.price || 0);
            });
            items = Object.values(grouped);
        }

        return { processedItems: items, totalQty: qty, totalPrice: price };
    }, [itemsWithDetails, viewMode]);

    if (!project) {
        return (
            <s-page heading="Project Not Found">
                <s-section>
                    <s-box padding="loose" textAlign="center">
                        <s-paragraph>The requested project could not be found.</s-paragraph>
                        <s-button onClick={() => navigate("/app/projects")}>Back to Projects</s-button>
                    </s-box>
                </s-section>
            </s-page>
        );
    }

    return (
        <s-page heading={project.name}>
            <s-section>
                <s-stack direction="block" gap="base">

                    <s-box paddingBlockEnd="400">
                        <s-stack direction="inline" gap="base" justify="space-between" align="center">
                            <s-button onClick={() => navigate("/app/projects")}>
                                Back to Projects
                            </s-button>

                            <s-stack direction="inline" gap="base" align="center">                                <s-select
                                value={viewMode}
                                onChange={(e) => setViewMode(e.target.value)}
                            >
                                <s-option value="area">Area View</s-option>
                                <s-option value="product">Product View</s-option>
                            </s-select>
                            </s-stack>
                        </s-stack>
                    </s-box>

                    <s-stack direction="block" gap="base">
                        {itemsWithDetails.length === 0 ? (
                            <s-box padding="loose" textAlign="center">
                                <s-paragraph>No products added to this project yet.</s-paragraph>
                            </s-box>
                        ) : (
                            <s-box borderWidth="base" borderRadius="base">
                                <s-table>
                                    <s-table-header-row>
                                        <s-table-header listSlot="primary">Product</s-table-header>
                                        <s-table-header listSlot="inline">{viewMode === "area" ? "Variant" : "Areas"}</s-table-header>
                                        <s-table-header listSlot="labeled" alignment="end">Quantity</s-table-header>
                                        <s-table-header listSlot="labeled" alignment="end">Price</s-table-header>
                                    </s-table-header-row>

                                    <s-table-body>
                                        {viewMode === "area" ? (
                                            processedItems.map((group) => (
                                                <React.Fragment key={group.displayTitle}>
                                                    <s-table-row>
                                                        <s-table-cell tone="success">
                                                            <s-text fontWeight="bold">Area: {group.displayTitle}</s-text>
                                                        </s-table-cell>
                                                        <s-table-cell></s-table-cell>
                                                        <s-table-cell alignment="end">
                                                            <s-text fontWeight="bold">{group.totalQty}</s-text>
                                                        </s-table-cell>
                                                        <s-table-cell alignment="end">
                                                            <s-text fontWeight="bold">${group.totalPrice.toFixed(2)}</s-text>
                                                        </s-table-cell>
                                                    </s-table-row>
                                                    {group.items.map(item => {
                                                        const imgUrl = item.variantDetails?.image?.url || item.variantDetails?.product?.featuredImage?.url;
                                                        return (
                                                            <s-table-row key={item.id}>
                                                                <s-table-cell>
                                                                    <s-stack direction="inline" gap="base" align="center">
                                                                        {imgUrl ? (
                                                                            <img src={imgUrl} style={{ width: '40px', height: '40px', borderRadius: '4px', objectFit: 'cover' }} alt="" />
                                                                        ) : (
                                                                            <s-box width="40px" minHeight="40px" background="subdued" borderRadius="base" />
                                                                        )}
                                                                        <s-text>{item.variantDetails?.product?.title}</s-text>
                                                                    </s-stack>
                                                                </s-table-cell>
                                                                <s-table-cell>{item.variantDetails?.title}</s-table-cell>
                                                                <s-table-cell alignment="end">{item.quantity}</s-table-cell>
                                                                <s-table-cell alignment="end">${(item.quantity * parseFloat(item.variantDetails?.price || 0)).toFixed(2)}</s-table-cell>
                                                            </s-table-row>
                                                        );
                                                    })}
                                                </React.Fragment>
                                            ))
                                        ) : (
                                            processedItems.map((item) => {
                                                const details = item.variantDetails;
                                                const imgUrl = details?.image?.url || details?.product?.featuredImage?.url;
                                                return (
                                                    <s-table-row key={item.variantId}>
                                                        <s-table-cell>
                                                            <s-stack direction="inline" gap="base" align="center">
                                                                {imgUrl ? (
                                                                    <img
                                                                        src={imgUrl}
                                                                        alt={details?.image?.altText || details?.product?.featuredImage?.altText || details?.title}
                                                                        style={{ width: '45px', height: '45px', objectFit: 'cover', borderRadius: '4px' }}
                                                                    />
                                                                ) : (
                                                                    <s-box width="45px" minHeight="45px" background="subdued" borderRadius="base" />
                                                                )}
                                                                <s-stack direction="block" gap="0">
                                                                    <s-text fontWeight="medium">{details?.product?.title || 'Unknown Product'}</s-text>
                                                                    <s-text tone="subdued">{details?.title || item.variantId}</s-text>
                                                                </s-stack>
                                                            </s-stack>
                                                        </s-table-cell>
                                                        <s-table-cell>
                                                            <s-stack direction="block" gap="none">
                                                                {item.areaList.map((area, i) => (
                                                                    <s-text tone="subdued" key={i}>{area}</s-text>
                                                                ))}
                                                            </s-stack>
                                                        </s-table-cell>
                                                        <s-table-cell alignment="end">
                                                            <s-text fontWeight="bold">{item.quantity}</s-text>
                                                        </s-table-cell>
                                                        <s-table-cell alignment="end">
                                                            {details?.price ? `$${(item.quantity * parseFloat(details.price)).toFixed(2)}` : '-'}
                                                        </s-table-cell>
                                                    </s-table-row>
                                                );
                                            })
                                        )}
                                        <s-table-row>
                                            <s-table-cell>
                                                <s-text fontWeight="bold">TOTAL:</s-text>
                                            </s-table-cell>
                                            <s-table-cell></s-table-cell>
                                            <s-table-cell alignment="end">
                                                <s-text fontWeight="bold" tone="success">{totalQty}</s-text>
                                            </s-table-cell>
                                            <s-table-cell alignment="end">
                                                <s-text fontWeight="bold" tone="success">${totalPrice.toFixed(2)}</s-text>
                                            </s-table-cell>
                                        </s-table-row>
                                    </s-table-body>
                                </s-table>
                            </s-box>
                        )}
                    </s-stack>
                </s-stack>
            </s-section>
        </s-page>
    );
}
