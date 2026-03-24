// api.project.list.jsx
import prisma from "../db.server";

export async function loader() {
    const projects = await prisma.project.findMany(); // fetch all projects
    return new Response(JSON.stringify({ projects }), {
        headers: { "Content-Type": "application/json" },
    });
}