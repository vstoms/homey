let address = 'Dummy Road 25'; // Endre til riktig adresse
let API_URL = "https://kalender.renovasjonsportal.no/api/address/";

async function fetchWasteCollection(address) {
    let encodedAddress = encodeURIComponent(address);
    let response = await fetch(API_URL + encodedAddress);
    if (!response.ok) {
        throw new Error('Failed to fetch address ID');
    }
    
    let data = await response.json();
    let addressId = data.searchResults[0].id;
    
    let detailsResponse = await fetch(API_URL + addressId + "/details/");
    if (!detailsResponse.ok) {
        throw new Error('Failed to fetch waste collection details');
    }
    
    let details = await detailsResponse.json();
    let disposals = details.disposals;
    
    let entries = [];
    for (let disposal of disposals) {
        let collectionDate = new Date(disposal.date);
        let collectionType = disposal.fraction;
        
        // Format the date to dd.mm.yyyy
        const day = String(collectionDate.getDate()).padStart(2, '0');
        const month = String(collectionDate.getMonth() + 1).padStart(2, '0');
        const year = collectionDate.getFullYear();
        const formattedDate = `${day}.${month}.${year}`;

        entries.push({
            date: formattedDate,
            type: collectionType,
        });
    }
    
    return entries;
}

async function updateHomeyVariables(entries) {
    let today = new Date();
    let wasteTypes = [
        "Restavfall",
        "Matavfall",
        "Papir",
        "Glass og metallemballasje",
        "Plastemballasje"
    ];
    
    let variablesObj;
    try {
        variablesObj = await Homey.logic.getVariables();
        console.log("Variables:", JSON.stringify(variablesObj, null, 2));
    } catch (error) {
        console.error("Error fetching variables:", error);
        return;
    }

    if (!variablesObj || typeof variablesObj !== 'object') {
        console.error("Invalid variables data received");
        return;
    }

    // Convert object to array
    let variables = Object.values(variablesObj);

    for (let type of wasteTypes) {
        let nextCollection = entries.find(entry => {
            let entryDate = new Date(entry.date.split('.').reverse().join('-'));
            return entry.type === type && entryDate >= today;
        });

        if (nextCollection) {
            let variable = variables.find(v => v.name === type);
            
            if (variable) {
                try {
                    await Homey.logic.updateVariable({
                        id: variable.id,
                        variable: { value: nextCollection.date }
                    });
                    console.log(`Updated ${type} to ${nextCollection.date}`);
                } catch (error) {
                    console.error(`Error updating ${type}:`, error);
                }
            } else {
                console.log(`Variable ${type} not found. Please create it in Homey.`);
            }
        } else {
            console.log(`No upcoming collection found for ${type}`);
        }
    }
}

async function main() {
    try {
        let result = await fetchWasteCollection(address);
        await updateHomeyVariables(result);
    } catch (error) {
        console.error("Error:", error);
    }
}

await main();
