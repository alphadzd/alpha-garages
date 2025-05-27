// Store vehicle data globally for history access
let currentVehicles = [];
let selectedVehicle = null;

window.addEventListener("message", function (event) {
    const data = event.data;
    if (data.action === "VehicleList") {
        const garageLabel = data.garageLabel;
        const vehicles = data.vehicles;
        currentVehicles = vehicles; // Store for later use
        populateVehicleList(garageLabel, vehicles);
        displayUI();
    } else if (data.action === "VehicleHistory") {
        populateVehicleHistory(data.history, data.plate);
    }
});

document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
        closeGarageMenu();
    }
});

function closeGarageMenu() {
    const container = document.querySelector(".container");

    container.classList.remove("show");
    setTimeout(() => {
        container.style.display = "none";
    }, 350); 

    fetch("https://alpha-garages/closeGarage", {
        method: "POST",
        headers: {
            "Content-Type": "application/json; charset=UTF-8",
        },
        body: JSON.stringify({}),
    })
        .then((response) => response.json())
        .then((data) => {
            if (data === "ok") {
                return;
            } else {
                console.error("Failed to close Garage UI");
            }
        });
}

function displayUI() {
    const container = document.querySelector(".container");
    container.style.display = "grid";
    // Add a small delay for the animation to trigger properly
    setTimeout(() => {
        container.classList.add("show");
    }, 10);
}

// Tab switching functionality
document.addEventListener("DOMContentLoaded", function() {
    const tabButtons = document.querySelectorAll(".tab-btn");
    
    tabButtons.forEach(button => {
        button.addEventListener("click", function() {
            // Remove active class from all buttons and content
            tabButtons.forEach(btn => btn.classList.remove("active"));
            document.querySelectorAll(".tab-content").forEach(content => {
                content.classList.remove("active");
            });
            
            // Add active class to clicked button and corresponding content
            this.classList.add("active");
            const tabName = this.getAttribute("data-tab");
            document.getElementById(tabName + "-tab").classList.add("active");
            
            // If maintenance tab is selected, update maintenance data
            if (tabName === "maintenance") {
                updateMaintenanceData();
            }
        });
    });
    
    // Search functionality
    const searchInput = document.getElementById("vehicle-search");
    const clearSearchBtn = document.getElementById("clear-search");
    
    searchInput.addEventListener("input", function() {
        filterVehicles();
    });
    
    clearSearchBtn.addEventListener("click", function() {
        searchInput.value = "";
        filterVehicles();
    });
    
    // Filter dropdown
    const filterBtn = document.querySelector(".filter-btn");
    const filterMenu = document.querySelector(".filter-menu");
    const filterOptions = document.querySelectorAll(".filter-option input");
    
    filterBtn.addEventListener("click", function() {
        filterMenu.classList.toggle("show");
        filterBtn.setAttribute("aria-expanded", filterMenu.classList.contains("show"));
        filterMenu.setAttribute("aria-hidden", !filterMenu.classList.contains("show"));
    });
    
    // Close filter menu when clicking outside
    document.addEventListener("click", function(event) {
        if (!event.target.closest(".filter-dropdown") && filterMenu.classList.contains("show")) {
            filterMenu.classList.remove("show");
            filterBtn.setAttribute("aria-expanded", "false");
            filterMenu.setAttribute("aria-hidden", "true");
        }
    });
    
    // Filter options
    filterOptions.forEach(option => {
        option.addEventListener("change", function() {
            // If "All Vehicles" is checked, uncheck others
            if (this.id === "filter-all" && this.checked) {
                filterOptions.forEach(opt => {
                    if (opt.id !== "filter-all") {
                        opt.checked = false;
                    }
                });
            } 
            // If any other option is checked, uncheck "All Vehicles"
            else if (this.id !== "filter-all" && this.checked) {
                document.getElementById("filter-all").checked = false;
            }
            
            // If no options are checked, check "All Vehicles"
            const anyChecked = Array.from(filterOptions).some(opt => opt.checked && opt.id !== "filter-all");
            if (!anyChecked) {
                document.getElementById("filter-all").checked = true;
            }
            
            filterVehicles();
        });
    });
});

// Function to request vehicle history
function requestVehicleHistory(plate) {
    selectedVehicle = plate;
    
    // Show loading state in history tab
    const historyTab = document.getElementById("history-tab");
    historyTab.innerHTML = `
        <div class="history-placeholder">
            <i class="fas fa-spinner fa-spin"></i>
            <p>Loading history for ${plate}...</p>
        </div>
    `;
    
    // Request history from server
    fetch("https://alpha-garages/getVehicleHistory", {
        method: "POST",
        headers: {
            "Content-Type": "application/json; charset=UTF-8",
        },
        body: JSON.stringify({ plate: plate }),
    });
}

// Function to populate vehicle history
function populateVehicleHistory(history, plate) {
    const historyTab = document.getElementById("history-tab");
    const fragment = document.createDocumentFragment();
    
    // Clear existing content
    historyTab.innerHTML = "";
    
    if (!history || history.length === 0) {
        const noHistory = document.createElement("div");
        noHistory.classList.add("history-placeholder");
        noHistory.innerHTML = `
            <i class="fas fa-exclamation-circle history-icon"></i>
            <p>No history available for ${plate}</p>
        `;
        historyTab.appendChild(noHistory);
        return;
    }
    
    // Add vehicle info header
    const vehicleInfo = document.createElement("div");
    vehicleInfo.classList.add("history-header");
    
    // Find the vehicle in our current list
    const vehicle = currentVehicles.find(v => v.plate === plate);
    if (vehicle) {
        vehicleInfo.innerHTML = `
            <h3>${vehicle.vehicleLabel} (${plate})</h3>
            <p>Showing recent activity</p>
        `;
    } else {
        vehicleInfo.innerHTML = `
            <h3>Vehicle ${plate}</h3>
            <p>Showing recent activity</p>
        `;
    }
    fragment.appendChild(vehicleInfo);
    
    // Add history items
    history.forEach(item => {
        const historyItem = document.createElement("div");
        historyItem.classList.add("history-item");
        
        // Determine icon based on action type
        let icon = "fa-question";
        if (item.type === "park") icon = "fa-parking";
        else if (item.type === "retrieve") icon = "fa-car";
        else if (item.type === "impound") icon = "fa-lock";
        else if (item.type === "transfer") icon = "fa-exchange-alt";
        
        historyItem.innerHTML = `
            <div class="history-icon-container">
                <i class="fas ${icon}"></i>
            </div>
            <div class="history-details">
                <span class="history-title">${item.title}</span>
                <span class="history-description">${item.description}</span>
            </div>
            <span class="history-time">${item.time}</span>
        `;
        
        fragment.appendChild(historyItem);
    });
    
    historyTab.appendChild(fragment);
}

// Filter vehicles based on search and filter options
function filterVehicles() {
    const searchInput = document.getElementById("vehicle-search");
    const searchTerm = searchInput.value.toLowerCase();
    const filterAll = document.getElementById("filter-all").checked;
    const filterAvailable = document.getElementById("filter-available").checked;
    const filterOut = document.getElementById("filter-out").checked;
    const filterImpound = document.getElementById("filter-impound").checked;
    
    const vehicleItems = document.querySelectorAll("#vehicles-tab .vehicle-item");
    
    vehicleItems.forEach(item => {
        const vehicleName = item.querySelector(".vehicle-name").textContent.toLowerCase();
        const vehiclePlate = item.querySelector(".plate").textContent.toLowerCase();
        const vehicleStatus = item.getAttribute("data-status");
        
        // Search term filter
        const matchesSearch = vehicleName.includes(searchTerm) || vehiclePlate.includes(searchTerm);
        
        // Status filter
        let matchesFilter = filterAll;
        if (filterAvailable && vehicleStatus === "available") matchesFilter = true;
        if (filterOut && vehicleStatus === "out") matchesFilter = true;
        if (filterImpound && vehicleStatus === "impound") matchesFilter = true;
        
        // Show or hide based on filters
        if (matchesSearch && matchesFilter) {
            item.style.display = "";
        } else {
            item.style.display = "none";
        }
    });
}

// Update maintenance data
function updateMaintenanceData() {
    if (!currentVehicles || currentVehicles.length === 0) return;
    
    // Update stats
    document.getElementById("total-vehicles").textContent = currentVehicles.length;
    
    // Count vehicles needing repair (engine or body damage > 50%)
    const needsRepair = currentVehicles.filter(v => 
        (v.engine && v.engine < 500) || (v.body && v.body < 500)
    ).length;
    document.getElementById("needs-repair").textContent = needsRepair;
    
    // Count vehicles needing service (mileage > 10000)
    const needsService = currentVehicles.filter(v => 
        v.mileage && v.mileage > 10000
    ).length;
    document.getElementById("needs-service").textContent = needsService;
    
    // Populate maintenance vehicles list
    const maintenanceList = document.getElementById("maintenance-vehicles-list");
    maintenanceList.innerHTML = "";
    
    if (currentVehicles.length === 0) {
        const placeholder = document.createElement("div");
        placeholder.classList.add("maintenance-placeholder");
        placeholder.innerHTML = `
            <i class="fas fa-car-crash maintenance-icon"></i>
            <p>No vehicles available for maintenance</p>
        `;
        maintenanceList.appendChild(placeholder);
        return;
    }
    
    // Sort vehicles by maintenance needs (most urgent first)
    const sortedVehicles = [...currentVehicles].sort((a, b) => {
        const aScore = calculateMaintenanceScore(a);
        const bScore = calculateMaintenanceScore(b);
        return bScore - aScore; // Higher score = more urgent
    });
    
    // Show top 5 vehicles needing maintenance
    sortedVehicles.slice(0, 5).forEach(vehicle => {
        const maintenanceItem = document.createElement("div");
        maintenanceItem.classList.add("maintenance-vehicle");
        
        // Calculate condition indicators
        const engineCondition = getConditionClass(vehicle.engine || 1000);
        const bodyCondition = getConditionClass(vehicle.body || 1000);
        const mileageCondition = getMileageConditionClass(vehicle.mileage || 0);
        
        maintenanceItem.innerHTML = `
            <div class="maintenance-vehicle-info">
                <span class="maintenance-vehicle-name">${vehicle.vehicleLabel}</span>
                <span class="maintenance-vehicle-plate">${vehicle.plate}</span>
                <div class="maintenance-indicators">
                    <span class="maintenance-indicator">
                        <i class="fas fa-engine indicator-icon ${engineCondition}"></i>
                        Engine
                    </span>
                    <span class="maintenance-indicator">
                        <i class="fas fa-car-side indicator-icon ${bodyCondition}"></i>
                        Body
                    </span>
                    <span class="maintenance-indicator">
                        <i class="fas fa-tachometer-alt indicator-icon ${mileageCondition}"></i>
                        ${formatMileage(vehicle.mileage || 0)}
                    </span>
                </div>
            </div>
            <div class="maintenance-actions">
                <button class="maintenance-btn repair">
                    <i class="fas fa-tools"></i>
                    Repair
                </button>
                <button class="maintenance-btn">
                    <i class="fas fa-info-circle"></i>
                    Details
                </button>
            </div>
        `;
        
        // Add repair button functionality
        const repairBtn = maintenanceItem.querySelector(".maintenance-btn.repair");
        repairBtn.addEventListener("click", function() {
            repairVehicle(vehicle.plate);
        });
        
        maintenanceList.appendChild(maintenanceItem);
    });
}

// Calculate maintenance score (higher = more urgent)
function calculateMaintenanceScore(vehicle) {
    let score = 0;
    
    // Engine damage (0-1000)
    const engine = vehicle.engine || 1000;
    score += (1000 - engine) / 10;
    
    // Body damage (0-1000)
    const body = vehicle.body || 1000;
    score += (1000 - body) / 20;
    
    // Mileage (higher = more urgent)
    const mileage = vehicle.mileage || 0;
    score += mileage / 1000;
    
    return score;
}

// Get condition class based on value (0-1000)
function getConditionClass(value) {
    if (value >= 800) return "indicator-good";
    if (value >= 500) return "indicator-warning";
    return "indicator-danger";
}

// Get mileage condition class
function getMileageConditionClass(mileage) {
    if (mileage < 5000) return "indicator-good";
    if (mileage < 10000) return "indicator-warning";
    return "indicator-danger";
}

// Format mileage
function formatMileage(mileage) {
    return new Intl.NumberFormat().format(mileage) + " mi";
}

// Repair vehicle
function repairVehicle(plate) {
    fetch("https://alpha-garages/repairVehicle", {
        method: "POST",
        headers: {
            "Content-Type": "application/json; charset=UTF-8",
        },
        body: JSON.stringify({ plate: plate }),
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // Update the vehicle in the current list
            const vehicleIndex = currentVehicles.findIndex(v => v.plate === plate);
            if (vehicleIndex !== -1) {
                currentVehicles[vehicleIndex].engine = 1000;
                currentVehicles[vehicleIndex].body = 1000;
                
                // Update maintenance view
                updateMaintenanceData();
            }
        }
    });
}

function populateVehicleList(garageLabel, vehicles) {
    const vehicleContainerElem = document.getElementById("vehicles-tab");
    const fragment = document.createDocumentFragment();

    while (vehicleContainerElem.firstChild) {
        vehicleContainerElem.removeChild(vehicleContainerElem.firstChild);
    }

    const garageHeader = document.getElementById("garage-header");
    garageHeader.textContent = garageLabel;

    vehicles.forEach((v) => {
        const vehicleItem = document.createElement("div");
        vehicleItem.classList.add("vehicle-item");
        
        // Add data attributes for filtering
        let status = "available";
        if (v.state === 0) status = "out";
        if (v.state === 2) status = "impound";
        vehicleItem.setAttribute("data-status", status);
        vehicleItem.setAttribute("data-plate", v.plate);

        // Vehicle Info: Name, Plate & Mileage
        const vehicleInfo = document.createElement("div");
        vehicleInfo.classList.add("vehicle-info");

        const vehicleName = document.createElement("span");
        vehicleName.classList.add("vehicle-name");
        vehicleName.textContent = v.vehicleLabel;
        vehicleInfo.appendChild(vehicleName);

        const plate = document.createElement("span");
        plate.classList.add("plate");
        plate.textContent = v.plate;
        vehicleInfo.appendChild(plate);

        const mileage = document.createElement("span");
        mileage.classList.add("mileage");
        mileage.textContent = `${v.distance}mi`;
        vehicleInfo.appendChild(mileage);

        vehicleItem.appendChild(vehicleInfo);

        // Finance Info
        const financeDriveContainer = document.createElement("div");
        financeDriveContainer.classList.add("finance-drive-container");
        const financeInfo = document.createElement("div");
        financeInfo.classList.add("finance-info");

        if (v.balance && v.balance > 0) {
            financeInfo.textContent = "Balance: $" + v.balance.toFixed(0);
            financeInfo.classList.add("debt");
        } else {
            financeInfo.textContent = "Paid Off";
        }

        financeDriveContainer.appendChild(financeInfo);

        // Drive Button
        let buttonStatus;
        let isDepotPrice = false;

        if (v.state === 0) {
            if (v.depotPrice && v.depotPrice > 0) {
                isDepotPrice = true;

                if (v.type === "public") {
                    buttonStatus = "Depot";
                } else if (v.type === "depot") {
                    buttonStatus = "$" + v.depotPrice.toFixed(0);
                } else {
                    buttonStatus = "Out";
                }
            } else {
                buttonStatus = "Out";
            }
        } else if (v.state === 1) {
            if (v.depotPrice && v.depotPrice > 0) {
                isDepotPrice = true;

                if (v.type === "depot") {
                    buttonStatus = "$" + v.depotPrice.toFixed(0);
                } else if (v.type === "public") {
                    buttonStatus = "Depot";
                } else {
                    buttonStatus = "Drive";
                }
            } else {
                buttonStatus = "Drive";
            }
        } else if (v.state === 2) {
            buttonStatus = "Impound";
        }

        const driveButton = document.createElement("button");
        driveButton.classList.add("drive-btn");
        driveButton.textContent = buttonStatus;

        if (buttonStatus === "Depot" || buttonStatus === "Impound") {
            driveButton.classList.add("disabled");
            driveButton.disabled = true;
        } else if (buttonStatus === "Out") {
            driveButton.classList.add("out");
            driveButton.textContent = "Return";
            
            // Create location tracking button
            const locationButton = document.createElement("button");
            locationButton.classList.add("location-btn");
            locationButton.innerHTML = '<i class="fas fa-map-marker-alt"></i>';
            locationButton.title = "Track vehicle location";
            
            // Add click handler for location button
            locationButton.onclick = function(e) {
                e.stopPropagation(); // Prevent triggering the parent button
                
                fetch("https://alpha-garages/trackVehicle", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json; charset=UTF-8",
                    },
                    body: JSON.stringify(v.plate),
                })
                .then((response) => response.json())
                .then((data) => {
                    if (data === "ok") {
                        closeGarageMenu();
                    }
                });
            };
            
            // Create history button
            const historyButton = document.createElement("button");
            historyButton.classList.add("history-btn");
            historyButton.innerHTML = '<i class="fas fa-history"></i>';
            historyButton.title = "View vehicle history";
            
            // Add click handler for history button
            historyButton.onclick = function(e) {
                e.stopPropagation(); // Prevent triggering the parent button
                
                // Switch to history tab
                document.querySelector('.tab-btn[data-tab="history"]').click();
                
                // Request vehicle history
                requestVehicleHistory(v.plate);
            };
            
            // Create a container for the buttons
            const buttonContainer = document.createElement("div");
            buttonContainer.classList.add("button-container");
            buttonContainer.appendChild(driveButton);
            buttonContainer.appendChild(locationButton);
            buttonContainer.appendChild(historyButton);
            
            // Replace the drive button with the container
            financeDriveContainer.appendChild(buttonContainer);
            
            // Remove the drive button we added earlier
            driveButton.remove();
        } else if (buttonStatus.startsWith("$")) {
            driveButton.classList.add("depot");
        }

        driveButton.onclick = function () {
            if (driveButton.disabled) return;

            const vehicleStats = {
                fuel: v.fuel,
                engine: v.engine,
                body: v.body,
            };

            const vehicleData = {
                vehicle: v.vehicle,
                garage: v.garage,
                index: v.index,
                plate: v.plate,
                type: v.type,
                depotPrice: v.depotPrice,
                stats: vehicleStats,
            };

            if (buttonStatus === "Out") {
                // We'll handle tracking with the new location button instead
                closeGarageMenu();
            } else if (isDepotPrice) {
                fetch("https://alpha-garages/takeOutDepo", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json; charset=UTF-8",
                    },
                    body: JSON.stringify(vehicleData),
                })
                    .then((response) => response.json())
                    .then((data) => {
                        if (data === "ok") {
                            closeGarageMenu();
                        } else {
                            console.error("Failed to pay depot price.");
                        }
                    });
            } else {
                fetch("https://alpha-garages/takeOutVehicle", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json; charset=UTF-8",
                    },
                    body: JSON.stringify(vehicleData),
                })
                    .then((response) => response.json())
                    .then((data) => {
                        if (data === "ok") {
                            closeGarageMenu();
                        } else {
                            console.error("Failed to close Garage UI.");
                        }
                    });
            }
        };

        // For vehicles that are out, we've already added the button to the container
        if (buttonStatus !== "Out") {
            financeDriveContainer.appendChild(driveButton);
        }
        vehicleItem.appendChild(financeDriveContainer);

        // Progress Bars: Fuel, Engine, Body
        const stats = document.createElement("div");
        stats.classList.add("stats");

        const maxValues = {
            fuel: 100,
            engine: 1000,
            body: 1000,
        };

        ["fuel", "engine", "body"].forEach((statLabel) => {
            const stat = document.createElement("div");
            stat.classList.add("stat");
            const label = document.createElement("div");
            label.classList.add("label");
            label.setAttribute("data-stat", statLabel);
            label.textContent = statLabel.charAt(0).toUpperCase() + statLabel.slice(1);
            stat.appendChild(label);
            const progressBar = document.createElement("div");
            progressBar.classList.add("progress-bar");
            const progress = document.createElement("span");
            const progressText = document.createElement("span");
            progressText.classList.add("progress-text");
            const percentage = (v[statLabel] / maxValues[statLabel]) * 100;

            // Set initial width to 0 for animation
            progress.style.width = "0%";
            progressText.textContent = Math.round(percentage) + "%";

            if (percentage >= 75) {
                progress.classList.add("bar-green");
            } else if (percentage >= 50) {
                progress.classList.add("bar-yellow");
            } else {
                progress.classList.add("bar-red");
            }

            progressBar.appendChild(progressText);
            progressBar.appendChild(progress);
            stat.appendChild(progressBar);
            stats.appendChild(stat);

            // Animate the progress bar after a short delay
            setTimeout(() => {
                progress.style.width = percentage + "%";
            }, 100 + (["fuel", "engine", "body"].indexOf(statLabel) * 100));
        });

        vehicleItem.appendChild(stats);

        fragment.appendChild(vehicleItem);
    });

    vehicleContainerElem.appendChild(fragment);
}
