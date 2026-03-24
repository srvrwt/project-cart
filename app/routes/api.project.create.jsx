import prisma from "../db.server";

export async function action({ request }) {
    const body = await request.json();

    const { name } = body;

    if (!name) {
        return new Response(JSON.stringify({ error: "Name required" }), {
            status: 400,
        });
    }

    const newProject = await prisma.project.create({
        data: { name }
    });

    return new Response(JSON.stringify({ project: newProject }), {
        headers: { "Content-Type": "application/json" },
    });
}