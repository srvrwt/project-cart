import prisma from "../db.server";
import { authenticate } from "../shopify.server";

export async function action({ request }) {
    const { session, admin } = await authenticate.admin(request);

    // An offline token has the shop name, while an online token can also have the user's email or name.
    let adminUser = session.email || `${session.firstName || ''} ${session.lastName || ''}`.trim();

    // If there is no email in the session (e.g. offline tokens), fetch the store email via GraphQL
    if (!adminUser && admin) {
        try {
            const response = await admin.graphql(
                `#graphql
                query {
                  shop {
                    email
                  }
                }`
            );
            const data = await response.json();
            adminUser = data.data?.shop?.email || session.shop;
        } catch (error) {
            console.error("Failed to fetch shop email:", error);
            adminUser = session.shop;
        }
    } else if (!adminUser) {
        adminUser = session.shop;
    }

    const body = await request.json();
    const { name } = body;

    if (!name) {
        return new Response(JSON.stringify({ error: "Name required" }), {
            status: 400,
        });
    }

    const newProject = await prisma.project.create({
        data: {
            name,
            userId: adminUser // Store the admin identifier
        }
    });

    return new Response(JSON.stringify({ project: newProject }), {
        headers: { "Content-Type": "application/json" },
    });
}