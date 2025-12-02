import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

export async function GET() {
    const session = await auth()

    if (!session?.user?.email) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
        where: { email: session.user.email },
        include: {
            datasets: true,
            models: true,
        },
    })

    if (!user) {
        return NextResponse.json({ message: "User not found" }, { status: 404 })
    }

    return NextResponse.json(user)
}

export async function POST(req: Request) {
    const session = await auth()

    if (!session?.user?.email) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    try {
        const data = await req.json()

        // Prevent updating email/password/id via this route for safety
        // Also exclude datasets/models from direct update here
        const { email, password, id, datasets, models, avatar, ...rest } = data

        const updates: any = { ...rest }
        if (avatar) {
            updates.image = avatar
        }

        const updatedUser = await prisma.user.update({
            where: { email: session.user.email },
            data: updates,
        })

        return NextResponse.json(updatedUser)
    } catch (error) {
        console.error("Profile update error:", error)
        return NextResponse.json({ message: "Update failed" }, { status: 500 })
    }
}
