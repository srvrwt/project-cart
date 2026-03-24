import prisma from "../db.server";

export async function action({ request }) {
    const body = await request.json();
    const { id, name } = body;

    if (!id || !name) {
        return new Response(JSON.stringify({ error: "ID and Name required" }), {
            status: 400,
        });
    }

    const updatedProject = await prisma.project.update({
        where: { id },
        data: { name }
    });

    return new Response(JSON.stringify({ project: updatedProject }), {
        headers: { "Content-Type": "application/json" },
    });
}
