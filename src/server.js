const app = require('./index');
const PORT = process.env.PORT || 4000;

// Explicitly add '0.0.0.0' to allow the USB bridge connection
app.listen(PORT, '0.0.0.0', () => {
    // console.log(`Server running on port ${PORT}`);
    console.log(`Accessible via ADB bridge at http://localhost:${PORT}`);
});

