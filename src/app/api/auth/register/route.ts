import { NextResponse } from "next/server"
import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

export async function POST(req: Request) {
    try {
        const { name, email, password } = await req.json()

        if (!email || !password) {
            return NextResponse.json(
                { message: "Missing required fields" },
                { status: 400 }
            )
        }

        // Check if user exists
        const existingUser = await prisma.user.findUnique({
            where: { email },
        })

        if (existingUser) {
            return NextResponse.json(
                { message: "User already exists" },
                { status: 400 }
            )
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10)

        // Create user
        const user = await prisma.user.create({
            data: {
                name,
                email,
                password: hashedPassword,
                themeColor: "#3b82f6", // Default blue
            },
        })

        return NextResponse.json(
            { message: "User created successfully", user: { id: user.id, email: user.email, name: user.name } },
            { status: 201 }
        )
    } catch (error) {
        console.error("Registration error:", error)
        return NextResponse.json(
            { message: "Internal server error" },
            { status: 500 }
        )
    }
}
