// Local Car Database
// This file is loaded directly by index.html

// Helper to clean and normalize any string for lookup
function cleanForSearch(text) {
    if (!text) return "";
    return text.toUpperCase()
        .replace(/O/g, "0")
        .replace(/I/g, "1")
        .replace(/L/g, "1")
        .replace(/Z/g, "2")
        .replace(/S/g, "5")
        .replace(/B/g, "8")
        .replace(/G/g, "6")
        .replace(/[^A-Z0-9]/g, "");
}

const CAR_DATASET = [
    {
        number: "MH14XY7890",
        ownerName: "Manshi rawat",
        carModel: "Swift dzire",
        color: "white",
        phone: "+91-9876543210",
    },
    {
        number: "MH12AB1234",
        ownerName: "Priya Singh",
        carModel: "i20",
        color: "White",
        phone: "+91-9876501234",
    },
    {
        number: "MH02AB5623",
        ownerName: "Amit Sharma",
        carModel: "Creta",
        color: "white",
        phone: "+91-9812345678",
    },
    {
        number: "MH01DV6729",
        ownerName: "Neha Gupta",
        carModel: "Harrier",
        color: "Blue",
        phone: "+91-9800011223",
    },
    {
        number: "MH43DN3282",
        ownerName: "Rohit Kumar",
        carModel: "Kia",
        color: "Silver",
        phone: "+91-9822334455",
    },
    {
        number: "MH03EF1843",
        ownerName: "Sneha Patel",
        carModel: "Baleno",
        color: "Grey",
        phone: "+91-9933445566",
    },
    {
        number: "MH01CD5678",
        ownerName: "Vikram Singh",
        carModel: "Thar",
        color: "Black",
        phone: "+91-9944556677",
    },
    {
        number: "MH01BT2265",
        ownerName: "Anjali Mehta",
        carModel: "BMW",
        color: "Red",
        phone: "+91-9955667788",
    },
    {
        number: "MH47PQ8290",
        ownerName: "Karan Johar",
        carModel: "Skoda Rapid",
        color: "Blue",
        phone: "+91-9966778899",
    },
    {
        number: "RJ14CY0002",
        ownerName: "Pooja Sharma",
        carModel: "KIA",
        color: "Brown",
        phone: "+91-9977889900",
    },
    // New Sample Data
    { number: "DL3CA1234", ownerName: "Rahul Verma", carModel: "Honda City", color: "White", phone: "+91-9876543211" },
    { number: "UP16Z5555", ownerName: "Suresh Raina", carModel: "Fortuner", color: "Black", phone: "+91-9876543212" },
    { number: "HR26DK8900", ownerName: "Vikas Dubey", carModel: "Verna", color: "Silver", phone: "+91-9876543213" },
    { number: "MH04GR7777", ownerName: "Ajay Devgn", carModel: "Scorpio", color: "White", phone: "+91-9876543214" },
    { number: "KA03HA1111", ownerName: "Vijay Kumar", carModel: "Innova", color: "Grey", phone: "+91-9876543215" },
    { number: "TN07AX9999", ownerName: "Rajinikanth", carModel: "Thar", color: "Black", phone: "+91-9876543216" },
    { number: "WB02P3333", ownerName: "Sourav Ganguly", carModel: "Merc C-Class", color: "Blue", phone: "+91-9876543217" },
    { number: "GJ01HH1001", ownerName: "Hardik P", carModel: "Audi A4", color: "Red", phone: "+91-9876543218" },
    { number: "MP09AB5678", ownerName: "Lata M", carModel: "Alto 800", color: "White", phone: "+91-9876543219" },
    { number: "PB10CD9090", ownerName: "Diljit S", carModel: "Range Rover", color: "White", phone: "+91-9876543220" },
    { number: "CH01EF2345", ownerName: "Milkha S", carModel: "Endeavour", color: "Black", phone: "+91-9876543221" },
    { number: "AP31GH6789", ownerName: "Prabhas", carModel: "Lamborghini", color: "Orange", phone: "+91-9876543222" },
    { number: "TS08JK0101", ownerName: "NTR Jr", carModel: "Porsche", color: "Yellow", phone: "+91-9876543223" },
    { number: "KL07LM4321", ownerName: "Mohanlal", carModel: "Land Cruiser", color: "White", phone: "+91-9876543224" },
    { number: "OR02NP8765", ownerName: "Naveen P", carModel: "Duster", color: "Brown", phone: "+91-9876543225" },
    { number: "JH01QR3456", ownerName: "MS Dhoni", carModel: "Hummer", color: "Green", phone: "+91-9876543226" },
    { number: "BR01ST7890", ownerName: "Pankaj T", carModel: "Bolero", color: "White", phone: "+91-9876543227" },
    { number: "CG04UV1212", ownerName: "Hemant S", carModel: "Safari", color: "Grey", phone: "+91-9876543228" },
    { number: "GA03WX5656", ownerName: "Remo F", carModel: "Beetle", color: "Red", phone: "+91-9876543229" },
    { number: "PY01YZ9009", ownerName: "Pondy Star", carModel: "Swift", color: "Blue", phone: "+91-9876543230" },
];

// Validates and searches for a car locally (Static + LocalStorage)
function findLocalCar(inputNumber) {
    if (!inputNumber) return null;

    const normalized = cleanForSearch(inputNumber);

    // 1. Search Static Data
    let found = CAR_DATASET.find((car) => {
        const storedNorm = cleanForSearch(car.number);
        return storedNorm === normalized;
    });

    if (found) return found;

    // 2. Search LocalStorage (User added cars)
    try {
        const customDocs = localStorage.getItem("CUSTOM_CARS");
        if (customDocs) {
            const customCars = JSON.parse(customDocs);
            found = customCars.find((car) => {
                const storedNorm = car.number.toUpperCase().replace(/[^A-Z0-9]/g, "");
                return storedNorm === normalized;
            });
        }
    } catch (e) {
        console.error("Error reading local storage", e);
    }

    return found || null;
}

// Remove car from LocalStorage
function deleteLocalCar(number) {
    if (!number) return false;

    try {
        const customDocs = localStorage.getItem("CUSTOM_CARS");
        if (customDocs) {
            let customCars = JSON.parse(customDocs);
            const initialLength = customCars.length;

            // Filter out the car (Normalize for comparison)
            const targetNorm = number.toUpperCase().replace(/[^A-Z0-9]/g, "");

            customCars = customCars.filter(car => {
                const currentNorm = car.number.toUpperCase().replace(/[^A-Z0-9]/g, "");
                return currentNorm !== targetNorm;
            });

            if (customCars.length < initialLength) {
                localStorage.setItem("CUSTOM_CARS", JSON.stringify(customCars));
                return true;
            }
        }
    } catch (e) {
        console.error("Error deleting", e);
    }
    return false; // Not found in local storage
}
