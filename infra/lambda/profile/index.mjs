import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const TABLE_NAME = process.env.TABLE_NAME || "HealthyProfiles";

export const handler = async (event) => {
    console.log("Event:", JSON.stringify(event));

    const method = event.requestContext?.http?.method || event.httpMethod;
    const path = event.rawPath || event.path;

    // CORS headers
    const headers = {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
    };

    if (method === "OPTIONS") {
        return { statusCode: 200, headers, body: "" };
    }

    try {
        // GET /profile
        if (method === "GET") {
            // In a real app, get email from auth token (Cognito/JWT)
            // For demo, we'll assume a query param or hardcoded for the single user
            const email = "sayandip.jana34@gmail.com";

            const command = new GetCommand({
                TableName: TABLE_NAME,
                Key: { email }
            });

            const response = await docClient.send(command);
            const profile = response.Item || {
                email,
                name: "Sayandip Jana",
                bio: "Always up for a new challenge..!",
                avatar: "",
                themeColor: "#E947F5"
            };

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify(profile)
            };
        }

        // POST /profile
        if (method === "POST") {
            const body = JSON.parse(event.body);
            // Ensure email is preserved/enforced
            const email = "sayandip.jana34@gmail.com";

            const newProfile = {
                ...body,
                email // Force email
            };

            const command = new PutCommand({
                TableName: TABLE_NAME,
                Item: newProfile
            });

            await docClient.send(command);

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify(newProfile)
            };
        }

        return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ error: "Not Found" })
        };

    } catch (error) {
        console.error("Error:", error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: "Internal Server Error" })
        };
    }
};
