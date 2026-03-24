import prisma from "../db.server";

export async function action({ request }) {
    const body = await request.json();
    const { id } = body;

    if (!id) {
        return new Response(JSON.stringify({ error: "ID required" }), {
            status: 400,
        });
    }

    await prisma.project.delete({
        where: { id }
    });

    return new Response(JSON.stringify({ success: true }), {
        headers: { "Content-Type": "application/json" },
    });
}
