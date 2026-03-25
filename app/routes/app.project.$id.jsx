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
            <s-button slot="primary-action" onClick={() => navigate("/app/projects")}>
                Back to Projects
            </s-button>

            <s-section>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
                    <button
                        onClick={() => setViewMode("area")}
                        style={{ padding: '8px 16px', borderRadius: '4px', border: '1px solid #c9cccf', background: viewMode === "area" ? "#008060" : "white", color: viewMode === "area" ? "white" : "#202223", cursor: 'pointer', fontWeight: 600 }}
                    >
                        Area View
                    </button>
                    <button
                        onClick={() => setViewMode("product")}
                        style={{ padding: '8px 16px', borderRadius: '4px', border: '1px solid #c9cccf', background: viewMode === "product" ? "#008060" : "white", color: viewMode === "product" ? "white" : "#202223", cursor: 'pointer', fontWeight: 600 }}
                    >
                        Product View
                    </button>
                </div>

                <s-stack direction="block" gap="base">
                    {itemsWithDetails.length === 0 ? (
                        <s-box padding="loose" textAlign="center">
                            <s-paragraph>No products added to this project yet.</s-paragraph>
                        </s-box>
                    ) : (
                        <>
                            <s-box borderWidth="base" borderRadius="base">
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                                        <tr style={{ background: '#f6f6f7', borderBottom: '1px solid #e1e3e5' }}>
                                            <th style={{ textAlign: 'left', padding: '12px 16px', fontWeight: 'bold' }}>Product</th>
                                            <th style={{ textAlign: 'left', padding: '12px 16px', fontWeight: 'bold' }}>{viewMode === "area" ? "Variant" : "Areas"}</th>
                                            <th style={{ textAlign: 'right', padding: '12px 16px', fontWeight: 'bold' }}>Quantity</th>
                                            <th style={{ textAlign: 'right', padding: '12px 16px', fontWeight: 'bold' }}>Price</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {viewMode === "area" ? (
                                            processedItems.map((group) => (
                                                <React.Fragment key={group.displayTitle}>
                                                    <tr style={{ background: '#f9fafb', fontWeight: 'bold', borderBottom: '1px solid #e1e3e5' }}>
                                                        <td colSpan="1" style={{ padding: '12px 16px', color: '#008060' }}>Area: {group.displayTitle}</td>
                                                        <td style={{ padding: '12px 16px' }}></td>
                                                        <td style={{ textAlign: 'right', padding: '12px 16px' }}>{group.totalQty}</td>
                                                        <td style={{ textAlign: 'right', padding: '12px 16px' }}>${group.totalPrice.toFixed(2)}</td>
                                                    </tr>
                                                    {group.items.map(item => {
                                                        const imgUrl = item.variantDetails?.image?.url || item.variantDetails?.product?.featuredImage?.url;
                                                        return (
                                                            <tr key={item.id} style={{ borderBottom: '1px solid #f1f2f3' }}>
                                                                <td style={{ padding: '12px 16px' }}>
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                                        {imgUrl ? (
                                                                            <img src={imgUrl} style={{ width: '40px', height: '40px', borderRadius: '4px', objectFit: 'cover' }} alt="" />
                                                                        ) : (
                                                                            <div style={{ width: '40px', height: '40px', background: '#f1f2f3', borderRadius: '4px' }} />
                                                                        )}
                                                                        <div>{item.variantDetails?.product?.title}</div>
                                                                    </div>
                                                                </td>
                                                                <td style={{ padding: '12px 16px' }}>{item.variantDetails?.title}</td>
                                                                <td style={{ textAlign: 'right', padding: '12px 16px' }}>{item.quantity}</td>
                                                                <td style={{ textAlign: 'right', padding: '12px 16px' }}>${(item.quantity * parseFloat(item.variantDetails?.price || 0)).toFixed(2)}</td>
                                                            </tr>
                                                        );
                                                    })}
                                                </React.Fragment>
                                            ))
                                        ) : (
                                            processedItems.map((item) => {
                                                const details = item.variantDetails;
                                                const imgUrl = details?.image?.url || details?.product?.featuredImage?.url;
                                                return (
                                                    <tr key={item.variantId} style={{ borderBottom: '1px solid #f1f2f3' }}>
                                                        <td style={{ padding: '12px 16px' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                                {imgUrl ? (
                                                                    <img
                                                                        src={imgUrl}
                                                                        alt={details?.image?.altText || details?.product?.featuredImage?.altText || details?.title}
                                                                        style={{ width: '45px', height: '45px', objectFit: 'cover', borderRadius: '4px' }}
                                                                    />
                                                                ) : (
                                                                    <div style={{ width: '45px', height: '45px', background: '#f1f2f3', borderRadius: '4px' }} />
                                                                )}
                                                                <div>
                                                                    <div style={{ fontWeight: '500' }}>{details?.product?.title || 'Unknown Product'}</div>
                                                                    <div style={{ fontSize: '12px', color: '#6d7175' }}>{details?.title || item.variantId}</div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td style={{ padding: '12px 16px', fontSize: '13px' }}>
                                                            <div>
                                                                {item.areaList.map((area, i) => (
                                                                    <div key={i}>{area}</div>
                                                                ))}
                                                            </div>
                                                        </td>
                                                        <td style={{ textAlign: 'right', padding: '12px 16px', fontWeight: 'bold' }}>
                                                            {item.quantity}
                                                        </td>
                                                        <td style={{ textAlign: 'right', padding: '12px 16px' }}>
                                                            {details?.price ? `$${(item.quantity * parseFloat(details.price)).toFixed(2)}` : '-'}
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                    <tfoot>
                                        <tr style={{ background: '#f6f6f7', fontWeight: 'bold', borderTop: '2px solid #e1e3e5' }}>
                                            <td colSpan="2" style={{ padding: '16px', textAlign: 'right', fontSize: '16px' }}>TOTAL:</td>
                                            <td style={{ textAlign: 'right', padding: '16px', fontSize: '16px', color: '#008060' }}>{totalQty}</td>
                                            <td style={{ textAlign: 'right', padding: '16px', fontSize: '16px', color: '#008060' }}>${totalPrice.toFixed(2)}</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </s-box>
                        </>
                    )}
                </s-stack>
            </s-section>
        </s-page>
    );
}
