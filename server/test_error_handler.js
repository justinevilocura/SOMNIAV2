import express from "express";
import cors from "cors";

const app = express();

app.use(cors());
app.use(express.json({ limit: '100kb' }));

app.post('/test', (req, res) => {
    res.json({ success: true });
});

app.use((err, req, res, next) => {
    if (err.type === 'entity.too.large') {
        return res.status(413).json({ success: false, message: 'Payload too large caught' });
    }
    res.status(500).json({ success: false, message: 'Generic error' });
});

app.listen(4001, () => {
    console.log("Test server running on 4001");
});
