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

    // 1. Fetch your Google Sheet data
    // Determine which sheet to fetch based on map type
    const sheetTab = (type === 'rep') ? 'RepData' : 'CommunityData';
    const fetchUrl = `${BASE_URL}?sheet=${sheetTab}`;

    try {
        const response = await fetch(fetchUrl);
        const sheetData = await response.json();
      
    // 2. Fetch Country Shapes
    const geoResponse = await fetch(GEOJSON_URL);
    const geoData = await geoResponse.json();

    // 3. Define the Tinting Style
    function style(feature) {
        const countryName = feature.properties.name;
        // Check if this country exists in our spreadsheet
        const match = sheetData.find(d => d.Country === countryName);
        
        return {
            fillColor: match ? (type === 'rep' ? '#003262' : '#FDB515') : 'transparent',
            weight: 1,
            opacity: 1,
            color: match ? '#fff' : 'transparent',
            fillOpacity: 0.7
        };
      } catch (error) {
        console.error("Error loading map data:", error);
      }  
    }

    // 4. Interaction (Hover)
    L.geoJson(geoData, {
        style: style,
        onEachFeature: (feature, layer) => {
            const match = sheetData.find(d => d.Country === feature.properties.name);
            if (match) {
                let content = `<strong>${feature.properties.name}</strong>`;
                if (type === 'rep') {
                    content = `
                        <div style="text-align:center; min-width:150px;">
                            <img src="${match.PhotoURL}" style="width:60px; height:60px; border-radius:50%; margin-bottom:8px;">
                            <br><strong>${match.Name}</strong><br>
                            <small>${match.Institution}</small><br>
                            <a href="mailto:${match.Email}" style="color:#003262; font-size:11px;">${match.Email}</a>
                        </div>`;
                } else {
                    content += `<br>${match.Count} Participants`;
                }
                layer.bindPopup(content);
                
                // Visual feedback on hover
                layer.on('mouseover', () => layer.setStyle({ fillOpacity: 0.9 }));
                layer.on('mouseout', () => layer.setStyle({ fillOpacity: 0.7 }));
            }
        }
    }).addTo(map);
}

// Initialize based on which page we are on
if (document.getElementById('communityMap')) initMap('community', 'communityMap');
if (document.getElementById('repMap')) initMap('rep', 'repMap');
