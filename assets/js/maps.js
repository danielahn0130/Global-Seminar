// Configuration
const GEOJSON_URL = 'https://raw.githubusercontent.com/datasets/geo-boundaries-world-110m/master/countries.geojson';
const BASE_URL = "https://script.google.com/macros/s/AKfycbxkNDxrHliV-PZW8RTBTk6evdI-XRKTGltoxnbEcGfU135XFwfFNOanCXYUbCHcaQehjw/exec";

async function initMap(type, elementId) {
    const map = L.map(elementId, { 
        scrollWheelZoom: false,
        attributionControl: false 
    }).setView([20, 10], 2);

    // Light, clean base layer
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png').addTo(map);

    const sheetTab = (type === 'rep') ? 'RepData' : 'CommunityData';
    const fetchUrl = `${BASE_URL}?sheet=${sheetTab}`;

    try {
        // 1. Fetch both Google Sheet data and GeoJSON outlines simultaneously
        const [sheetResponse, geoResponse] = await Promise.all([
            fetch(fetchUrl),
            fetch(GEOJSON_URL)
        ]);

        const sheetData = await sheetResponse.json();
        const geoData = await geoResponse.json();
// --- ADD THIS LINE TEMPORARILY ---
console.log("Map Country Names:", geoData.features.map(f => f.properties.name).sort());
// ---------------------------------
        // 2. Define the Tinting Style
        function getStyle(feature) {
            const countryName = feature.properties.name;
            const match = sheetData.find(d => d.Country === countryName);
            
            return {
                fillColor: match ? (type === 'rep' ? '#003262' : '#FDB515') : 'transparent',
                weight: 1,
                opacity: 1,
                color: match ? '#fff' : 'transparent',
                fillOpacity: 0.7
            };
        }

        // 3. Interaction & Popups
        L.geoJson(geoData, {
            style: getStyle,
            onEachFeature: (feature, layer) => {
                const countryName = feature.properties.name;
                const match = sheetData.find(d => d.Country === countryName);

                if (match) {
                    let content = `<strong>${countryName}</strong>`;
                    if (type === 'rep') {
                        content = `
                            <div style="text-align:center; min-width:150px;">
                                <img src="${match.PhotoURL}" style="width:60px; height:60px; border-radius:50%; object-fit:cover; margin-bottom:8px; border:1px solid #ddd;">
                                <br><strong>${match.Name}</strong><br>
                                <small>${match.Institution}</small><br>
                                <a href="mailto:${match.Email}" style="color:#003262; font-size:11px;">${match.Email}</a>
                            </div>`;
                    } else {
                        content += `<br>${match.Count} Participants`;
                    }
                    layer.bindPopup(content);
                    
                    layer.on('mouseover', () => layer.setStyle({ fillOpacity: 0.9 }));
                    layer.on('mouseout', () => layer.setStyle({ fillOpacity: 0.7 }));
                }
            }
        }).addTo(map);

    } catch (error) {
        console.error("Error loading map data:", error);
    }
}

// Initialize based on which div is found on the page
if (document.getElementById('communityMap')) initMap('community', 'communityMap');
if (document.getElementById('repMap')) initMap('rep', 'repMap');
