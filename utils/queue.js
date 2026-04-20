import amqp from "amqplib";

export const sendToQueue = async (queueName, message) => {
    let connection;
    let channel;
    try {
        if (!process.env.RABBITMQ_URL) {
            console.error("[queue] RABBITMQ_URL is missing; cannot enqueue", { queueName });
            return false;
        }

        connection = await amqp.connect(process.env.RABBITMQ_URL);
        connection.on("error", (err) => {
            console.error("[queue] connection error:", err?.message ?? err);
        });
        connection.on("close", () => {
            console.error("[queue] connection closed");
        });

        channel = await connection.createChannel();
        channel.on("error", (err) => {
            console.error("[queue] channel error:", err?.message ?? err);
        });
        channel.on("close", () => {
            console.error("[queue] channel closed");
        });

        await channel.assertQueue(queueName, { durable: true });

        const payload = Buffer.from(JSON.stringify(message));
        const ok = channel.sendToQueue(queueName, payload, { persistent: true });

        console.log("[queue] publish attempted", {
            queueName,
            ok,
            messageKeys: message && typeof message === "object" ? Object.keys(message) : undefined,
        });

        return Boolean(ok);
    } catch (err) {
        console.error("[queue] sendToQueue failed:", err?.message ?? err, {
            queueName,
        });
        return false;
    } finally {
        try {
            if (channel) await channel.close();
        } catch (e) {
            console.error("[queue] channel.close failed:", e?.message ?? e);
        }
        try {
            if (connection) await connection.close();
        } catch (e) {
            console.error("[queue] connection.close failed:", e?.message ?? e);
        }
    }
};