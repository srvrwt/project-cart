import prisma from "../db.server";
import { authenticate } from "../shopify.server";

export async function action({ request }) {
    const { session } = await authenticate.admin(request);
    
    // An offline token has the shop name, while an online token can also have the user's email or name.
    const adminUser = session.email || `${session.firstName || ''} ${session.lastName || ''}`.trim() || session.shop;

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