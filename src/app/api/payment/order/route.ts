import { NextResponse } from "next/server";
import Razorpay from "razorpay";

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID!,
    key_secret: process.env.RAZOR_SECRET_KEY!,
});

export async function POST(req: Request) {
    try {
        const { amount } = await req.json();

        if (amount === 0) {
            return NextResponse.json({ id: "free_plan", amount: 0, currency: "INR" });
        }

        const options = {
            amount: amount * 100, // Amount in paise
            currency: "INR",
            receipt: "receipt_" + Math.random().toString(36).substring(7),
        };

        const order = await razorpay.orders.create(options);
        return NextResponse.json(order);
    } catch (error) {
        console.error("Razorpay Error:", error);
        return NextResponse.json({ error: "Error creating order" }, { status: 500 });
    }
}
