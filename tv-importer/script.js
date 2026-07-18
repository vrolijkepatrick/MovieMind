const loadDatabaseInput = document.getElementById("loadDatabaseInput");
const newDatabaseBtn = document.getElementById("newDatabaseBtn");
const exportBtn = document.getElementById("exportBtn");
const databaseCount = document.getElementById("databaseCount");
const lastAddedSeriesElement = document.getElementById("lastAddedSeries");
const recentSeriesList = document.getElementById("recentSeriesList");
const databaseStatus = document.getElementById("databaseStatus");

const seriesTabBtn = document.getElementById("seriesTabBtn");
const actorTabBtn = document.getElementById("actorTabBtn");
const seriesSearchView = document.getElementById("seriesSearchView");
const actorSearchView = document.getElementById("actorSearchView");

const seriesTitleInput = document.getElementById("seriesTitle");
const actorNameInput = document.getElementById("actorName");
const searchBtn = document.getElementById("searchBtn");
const actorSearchBtn = document.getElementById("actorSearchBtn");
const seriesSuggestions = document.getElementById("seriesSuggestions");
const actorSuggestions = document.getElementById("actorSuggestions");

const choosePhotoFolderBtn =
    document.getElementById("choosePhotoFolderBtn");
const saveActorPhotoBtn =
    document.getElementById("saveActorPhotoBtn");
const photoStatus =
    document.getElementById("photoStatus");

const resultsTitle = document.getElementById("resultsTitle");
const resultsSubtitle = document.getElementById("resultsSubtitle");
const resultsList = document.getElementById("resultsList");

const selectionToolbar = document.getElementById("selectionToolbar");
const selectAllBtn = document.getElementById("selectAllBtn");
const clearSelectionBtn = document.getElementById("clearSelectionBtn");
const hideImportedCheckbox = document.getElementById("hideImportedCheckbox");
const selectionCount = document.getElementById("selectionCount");

const batchBar = document.getElementById("batchBar");
const batchSelectionCount = document.getElementById("batchSelectionCount");
const batchProgressText = document.getElementById("batchProgressText");
const addSelectedBtn = document.getElementById("addSelectedBtn");

let importedSeries = [];
let lastAddedSeries = null;
let databaseActive = false;
let loadedDatabaseFileName = "moviemind_tv_database.json";

const availableSeries = new Map();
const STORAGE_KEY = "movieMindTvImporterDatabaseV2";
let selectedActor = null;
let actorPhotoDirectoryHandle = null;

const PHOTO_DB_NAME = "MovieMindTvImporter";
const PHOTO_STORE_NAME = "settings";
const PHOTO_HANDLE_KEY = "actorPhotoDirectoryHandle";
const ACTIVE_TAB_KEY = "movieMindTvImporterActiveTab";
let activeSearchTab = "series";

const SERIES_CAST_LIMIT = 8;

function addSafeListener(element, eventName, handler) {
    if (!element) {
        console.error(
            "Element ontbreekt voor event:",
            eventName
        );
        return;
    }

    element.addEventListener(eventName, handler);
}



/* =========================================================
   TABBLADEN
========================================================= */

seriesTabBtn.addEventListener("click", function () {
    showSearchTab("series");
});

actorTabBtn.addEventListener("click", function () {
    showSearchTab("actor");
});

function showSearchTab(tab) {
    activeSearchTab =
        tab === "actor"
            ? "actor"
            : "series";

    const seriesActive =
        activeSearchTab === "series";

    seriesTabBtn.classList.toggle(
        "active",
        seriesActive
    );

    actorTabBtn.classList.toggle(
        "active",
        !seriesActive
    );

    seriesSearchView.classList.toggle(
        "hidden",
        !seriesActive
    );

    actorSearchView.classList.toggle(
        "hidden",
        seriesActive
    );

    hideSuggestions();

    try {
        localStorage.setItem(
            ACTIVE_TAB_KEY,
            activeSearchTab
        );
    } catch (error) {
        console.warn(
            "Actieve zoektab onthouden mislukt:",
            error
        );
    }
}


/* =========================================================
   DATABASE
========================================================= */

loadDatabaseInput.addEventListener("change", loadDatabase);
newDatabaseBtn.addEventListener("click", createNewDatabase);
exportBtn.addEventListener("click", exportDatabase);

function loadDatabase(event) {
    const file = event.target.files[0];

    if (!file) {
        return;
    }

    const reader = new FileReader();

    reader.onload = function () {
        try {
            const parsed = JSON.parse(reader.result);
            const series = readSeriesArray(parsed);

            importedSeries = deduplicateSeries(series);
            loadedDatabaseFileName =
                file.name || "moviemind_tv_database.json";
            lastAddedSeries = null;
            databaseActive = true;

            refreshDatabasePanel();
            refreshVisibleSeriesCards();
            saveActiveDatabase();

            setDatabaseStatus(
                importedSeries.length + " unieke series geladen.",
                "success"
            );
        } catch (error) {
            console.error(error);
            alert("Dit is geen geldige MovieMind TV-database.");
        } finally {
            loadDatabaseInput.value = "";
        }
    };

    reader.readAsText(file);
}

function readSeriesArray(parsed) {
    if (parsed && Array.isArray(parsed.series)) {
        return parsed.series;
    }

    if (parsed && Array.isArray(parsed.films)) {
        return parsed.films.filter(function (item) {
            return item && item.media_type === "tv";
        });
    }

    throw new Error("Geen geldige series-array gevonden.");
}

function createNewDatabase() {
    if (
        databaseActive &&
        importedSeries.length > 0 &&
        !confirm(
            "Er staat al een actieve seriedatabase.\n\n" +
            "Wil je echt met een lege database beginnen?"
        )
    ) {
        return;
    }

    importedSeries = [];
    lastAddedSeries = null;
    databaseActive = true;
    loadedDatabaseFileName = "moviemind_tv_database.json";

    refreshDatabasePanel();
    refreshVisibleSeriesCards();
    saveActiveDatabase();

    setDatabaseStatus(
        "Nieuwe lege seriedatabase actief.",
        "success"
    );
}

function exportDatabase() {
    if (!databaseActive) {
        alert("Laad eerst een database of klik op ‘Nieuwe database’.");
        return;
    }

    const data = {
        database_type: "moviemind_tv",
        version: 2,
        series: importedSeries
    };

    const blob = new Blob(
        [JSON.stringify(data, null, 2)],
        { type: "application/json" }
    );

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = loadedDatabaseFileName;

    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(function () {
        URL.revokeObjectURL(url);
    }, 1000);

    setDatabaseStatus(
        importedSeries.length + " series geëxporteerd.",
        "success"
    );
}


/* =========================================================
   SERIE ZOEKEN
========================================================= */

searchBtn.addEventListener("click", searchSeries);

seriesTitleInput.addEventListener("keydown", function (event) {
    if (event.key === "Enter") {
        event.preventDefault();
        searchSeries();
    }
});

async function searchSeries() {
    const query = seriesTitleInput.value.trim();

    if (!query) {
        alert("Typ eerst een serienaam.");
        return;
    }

    searchBtn.disabled = true;
    searchBtn.textContent = "Zoeken...";

    try {
        const url =
            "https://api.themoviedb.org/3/search/tv" +
            "?api_key=" + TMDB_API_KEY +
            "&language=en-US" +
            "&include_adult=false" +
            "&query=" + encodeURIComponent(query);

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error("HTTP " + response.status);
        }

        const data = await response.json();

        const series = (data.results || [])
            .filter(function (item) {
                return item.id && item.name;
            })
            .map(mapSearchSeries)
            .sort(function (a, b) {
                return b.popularity - a.popularity;
            })
            .slice(0, 20);

        cacheSeries(series);

        renderSeriesResults(
            "Zoekresultaten voor “" + query + "”",
            series
        );
    } catch (error) {
        console.error(error);
        alert(
            "Er ging iets mis bij het zoeken naar series.\n\n" +
            error.message
        );
    } finally {
        searchBtn.disabled = false;
        searchBtn.textContent = "Serie zoeken";
    }
}


/* =========================================================
   ACTEUR ZOEKEN
========================================================= */

actorSearchBtn.addEventListener("click", searchActor);

actorNameInput.addEventListener("keydown", function (event) {
    if (event.key === "Enter") {
        event.preventDefault();
        searchActor();
    }
});

async function searchActor() {
    const query = actorNameInput.value.trim();

    if (!query) {
        alert("Typ eerst een acteur of actrice.");
        return;
    }

    actorSearchBtn.disabled = true;
    actorSearchBtn.textContent = "Zoeken...";

    try {
        let actor = selectedActor;

        if (
            !actor ||
            normalizeText(actor.name) !== normalizeText(query)
        ) {
            actor = await findActorByName(query);
        }

        if (!actor) {
            alert("Geen acteur of actrice gevonden.");
            return;
        }

        const response = await fetch(
            "https://api.themoviedb.org/3/person/" +
            actor.id +
            "/tv_credits" +
            "?api_key=" + TMDB_API_KEY +
            "&language=nl-NL"
        );

        if (!response.ok) {
            throw new Error("HTTP " + response.status);
        }

        const data = await response.json();
        const unique = new Map();

        (data.cast || [])
            .filter(isAllowedTvActorCredit)
            .forEach(function (item) {
                const mapped = mapSearchSeries(item);

                if (item.character) {
                    mapped.character = item.character;
                }

                unique.set(Number(mapped.id), mapped);
            });

        const series = Array.from(unique.values())
            .sort(function (a, b) {
                return (b.year || 0) - (a.year || 0);
            });

        selectedActor = actor;
        actorNameInput.value = actor.name;
        updatePhotoButton();
        showSearchTab("actor");
        cacheSeries(series);

        renderSeriesResults(
            "Series van " + actor.name,
            series
        );
    } catch (error) {
        console.error(error);
        alert(
            "Er ging iets mis bij het zoeken naar de acteur.\n\n" +
            error.message
        );
    } finally {
        actorSearchBtn.disabled = false;
        actorSearchBtn.textContent = "Acteur zoeken";
    }
}

async function findActorByName(name) {
    const response = await fetch(
        "https://api.themoviedb.org/3/search/person" +
        "?api_key=" + TMDB_API_KEY +
        "&language=en-US" +
        "&include_adult=false" +
        "&query=" + encodeURIComponent(name)
    );

    if (!response.ok) {
        throw new Error("HTTP " + response.status);
    }

    const data = await response.json();

    const actors = (data.results || [])
        .filter(function (person) {
            return (
                person.id &&
                person.name &&
                (
                    person.known_for_department === "Acting" ||
                    !person.known_for_department
                )
            );
        })
        .sort(function (a, b) {
            const exactA =
                normalizeText(a.name) === normalizeText(name);
            const exactB =
                normalizeText(b.name) === normalizeText(name);

            if (exactA && !exactB) {
                return -1;
            }

            if (!exactA && exactB) {
                return 1;
            }

            return (b.popularity || 0) - (a.popularity || 0);
        });

    return actors.length > 0
        ? {
            id: actors[0].id,
            name: actors[0].name,
            profile_path: actors[0].profile_path || null
        }
        : null;
}


/* =========================================================
   AANVULVELDEN
========================================================= */

let seriesSuggestionTimer = null;
let actorSuggestionTimer = null;

addSafeListener(seriesTitleInput, "input", function () {
    clearTimeout(seriesSuggestionTimer);

    const query = seriesTitleInput.value.trim();

    if (query.length < 2) {
        seriesSuggestions.classList.add("hidden");
        return;
    }

    seriesSuggestionTimer = setTimeout(function () {
        loadSeriesSuggestions(query);
    }, 300);
});

addSafeListener(actorNameInput, "input", function () {
    clearTimeout(actorSuggestionTimer);

    selectedActor = null;
    updatePhotoButton();

    const query = actorNameInput.value.trim();

    if (query.length < 2) {
        actorSuggestions.classList.add("hidden");
        return;
    }

    actorSuggestionTimer = setTimeout(function () {
        loadActorSuggestions(query);
    }, 300);
});

async function loadSeriesSuggestions(query) {
    try {
        const response = await fetch(
            "https://api.themoviedb.org/3/search/tv" +
            "?api_key=" + TMDB_API_KEY +
            "&language=en-US" +
            "&include_adult=false" +
            "&query=" + encodeURIComponent(query)
        );

        if (!response.ok) {
            throw new Error("Suggesties ophalen mislukt.");
        }

        const data = await response.json();

        renderSuggestions(
            seriesSuggestions,
            (data.results || [])
                .filter(function (item) {
                    return item.id && item.name;
                })
                .slice(0, 8)
                .map(function (item) {
                    return {
                        title: item.name,
                        subtitle: item.first_air_date
                            ? item.first_air_date.slice(0, 4)
                            : "jaar onbekend",
                        onClick: function () {
                            seriesTitleInput.value = item.name;
                            seriesSuggestions.classList.add("hidden");
                            searchSeries();
                        }
                    };
                })
        );
    } catch (error) {
        seriesSuggestions.classList.add("hidden");
    }
}

async function loadActorSuggestions(query) {
    try {
        const response = await fetch(
            "https://api.themoviedb.org/3/search/person" +
            "?api_key=" + TMDB_API_KEY +
            "&language=en-US" +
            "&include_adult=false" +
            "&query=" + encodeURIComponent(query)
        );

        if (!response.ok) {
            throw new Error("Suggesties ophalen mislukt.");
        }

        const data = await response.json();

        renderSuggestions(
            actorSuggestions,
            (data.results || [])
                .filter(function (person) {
                    return (
                        person.id &&
                        person.name &&
                        (
                            person.known_for_department === "Acting" ||
                            !person.known_for_department
                        )
                    );
                })
                .slice(0, 8)
                .map(function (person) {
                    return {
                        title: person.name,
                        subtitle: (person.known_for || [])
                            .map(function (item) {
                                return item.name || item.title;
                            })
                            .filter(Boolean)
                            .slice(0, 2)
                            .join(" • ") || "TV-credits beschikbaar",
                        onClick: function () {
                            selectedActor = {
                                id: person.id,
                                name: person.name,
                                profile_path: person.profile_path || null
                            };

                            actorNameInput.value = person.name;
                            actorSuggestions.classList.add("hidden");
                            updatePhotoButton();
                            searchActor();
                        }
                    };
                })
        );
    } catch (error) {
        actorSuggestions.classList.add("hidden");
    }
}

function renderSuggestions(container, suggestions) {
    container.innerHTML = "";

    if (suggestions.length === 0) {
        container.classList.add("hidden");
        return;
    }

    suggestions.forEach(function (suggestion) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "suggestion-button";

        const title = document.createElement("strong");
        title.textContent = suggestion.title;

        const subtitle = document.createElement("small");
        subtitle.textContent = suggestion.subtitle;

        button.appendChild(title);
        button.appendChild(subtitle);
        button.addEventListener("click", suggestion.onClick);

        container.appendChild(button);
    });

    container.classList.remove("hidden");
}

function hideSuggestions() {
    if (seriesSuggestions) {
        seriesSuggestions.classList.add("hidden");
    }

    if (actorSuggestions) {
        actorSuggestions.classList.add("hidden");
    }
}

document.addEventListener("click", function (event) {
    if (
        !seriesSuggestions.contains(event.target) &&
        event.target !== seriesTitleInput
    ) {
        seriesSuggestions.classList.add("hidden");
    }

    if (
        !actorSuggestions.contains(event.target) &&
        event.target !== actorNameInput
    ) {
        actorSuggestions.classList.add("hidden");
    }
});


/* =========================================================
   ACTEURSFOTO'S
========================================================= */

addSafeListener(
    choosePhotoFolderBtn,
    "click",
    choosePhotoFolder
);

addSafeListener(
    saveActorPhotoBtn,
    "click",
    saveSelectedActorPhoto
);

async function choosePhotoFolder() {
    if (!("showDirectoryPicker" in window)) {
        setPhotoStatus(
            "Gebruik Chrome of Edge voor rechtstreeks opslaan in een map.",
            "error"
        );
        return;
    }

    try {
        let handle = await loadSavedPhotoHandle();

        if (handle) {
            const permission = await requestDirectoryPermission(handle);

            if (!permission) {
                handle = null;
            }
        }

        if (!handle) {
            handle = await window.showDirectoryPicker({
                mode: "readwrite"
            });
        }

        if (!await requestDirectoryPermission(handle)) {
            throw new Error("Geen schrijftoestemming.");
        }

        actorPhotoDirectoryHandle = handle;
        await savePhotoHandle(handle);

        setPhotoStatus(
            "Acteursfotomap actief: " + handle.name +
            ". Nieuwe series slaan automatisch de top 8 castfoto’s op.",
            "success"
        );

        updatePhotoButton();
    } catch (error) {
        if (error && error.name === "AbortError") {
            return;
        }

        console.error(error);

        setPhotoStatus(
            "De acteursfotomap kon niet worden geopend.",
            "error"
        );
    }
}

async function saveSelectedActorPhoto() {
    if (!selectedActor) {
        alert("Zoek eerst een acteur of actrice.");
        return;
    }

    if (!actorPhotoDirectoryHandle) {
        alert("Kies eerst de acteursfotomap.");
        return;
    }

    saveActorPhotoBtn.disabled = true;

    try {
        const result = await saveActorPhotoCandidate(selectedActor);

        if (result === "downloaded") {
            alert(
                createActorPhotoFilename(selectedActor.name) +
                " is opgeslagen."
            );
        } else if (result === "existing") {
            alert("De foto stond al in de acteursmap.");
        } else if (result === "missing") {
            alert("TMDB heeft geen foto voor deze acteur.");
        } else {
            alert("De foto kon niet worden opgeslagen.");
        }
    } finally {
        updatePhotoButton();
    }
}

async function saveActorPhotoCandidate(candidate) {
    if (!candidate || !candidate.name) {
        return "failed";
    }

    if (!candidate.profile_path) {
        return "missing";
    }

    const filename = createActorPhotoFilename(candidate.name);

    try {
        if (await fileExists(actorPhotoDirectoryHandle, filename)) {
            return "existing";
        }

        const response = await fetch(
            "https://image.tmdb.org/t/p/w500" +
            candidate.profile_path
        );

        if (!response.ok) {
            throw new Error("Afbeelding ophalen mislukt.");
        }

        const blob = await response.blob();
        const fileHandle =
            await actorPhotoDirectoryHandle.getFileHandle(
                filename,
                { create: true }
            );

        const writable = await fileHandle.createWritable();

        try {
            await writable.write(blob);
        } finally {
            await writable.close();
        }

        return "downloaded";
    } catch (error) {
        console.error(
            "Foto opslaan mislukt:",
            candidate.name,
            error
        );

        return "failed";
    }
}

function createActorPhotoFilename(name) {
    const safeName = String(name || "")
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/&/g, " and ")
        .replace(/['’]/g, "")
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");

    return (safeName || "acteur") + ".jpg";
}

async function fileExists(directoryHandle, filename) {
    try {
        await directoryHandle.getFileHandle(filename);
        return true;
    } catch (error) {
        if (error && error.name === "NotFoundError") {
            return false;
        }

        throw error;
    }
}

function updatePhotoButton() {
    if (!saveActorPhotoBtn) {
        return;
    }

    saveActorPhotoBtn.disabled =
        !(selectedActor && actorPhotoDirectoryHandle);
}

function setPhotoStatus(message, state) {
    if (!photoStatus) {
        return;
    }

    photoStatus.textContent = message;
    photoStatus.className =
        "info-box" + (state ? " " + state : "");
}


/* =========================================================
   FOTOMAP ONTHOUDEN
========================================================= */

function openPhotoDatabase() {
    return new Promise(function (resolve, reject) {
        const request = indexedDB.open(
            PHOTO_DB_NAME,
            1
        );

        request.onupgradeneeded = function () {
            const database = request.result;

            if (
                !database.objectStoreNames.contains(
                    PHOTO_STORE_NAME
                )
            ) {
                database.createObjectStore(
                    PHOTO_STORE_NAME
                );
            }
        };

        request.onsuccess = function () {
            resolve(request.result);
        };

        request.onerror = function () {
            reject(request.error);
        };
    });
}

async function savePhotoHandle(handle) {
    const database = await openPhotoDatabase();

    await new Promise(function (resolve, reject) {
        const transaction = database.transaction(
            PHOTO_STORE_NAME,
            "readwrite"
        );

        transaction
            .objectStore(PHOTO_STORE_NAME)
            .put(handle, PHOTO_HANDLE_KEY);

        transaction.oncomplete = resolve;
        transaction.onerror = function () {
            reject(transaction.error);
        };
    });

    database.close();
}

async function loadSavedPhotoHandle() {
    if (!("indexedDB" in window)) {
        return null;
    }

    const database = await openPhotoDatabase();

    const handle = await new Promise(function (resolve, reject) {
        const transaction = database.transaction(
            PHOTO_STORE_NAME,
            "readonly"
        );

        const request =
            transaction
                .objectStore(PHOTO_STORE_NAME)
                .get(PHOTO_HANDLE_KEY);

        request.onsuccess = function () {
            resolve(request.result || null);
        };

        request.onerror = function () {
            reject(request.error);
        };
    });

    database.close();
    return handle;
}

async function requestDirectoryPermission(handle) {
    const options = { mode: "readwrite" };

    if (
        typeof handle.queryPermission === "function" &&
        await handle.queryPermission(options) === "granted"
    ) {
        return true;
    }

    if (
        typeof handle.requestPermission === "function" &&
        await handle.requestPermission(options) === "granted"
    ) {
        return true;
    }

    return false;
}

async function restorePhotoFolder() {
    try {
        const handle = await loadSavedPhotoHandle();

        if (!handle) {
            return;
        }

        const permission =
            typeof handle.queryPermission === "function"
                ? await handle.queryPermission({
                    mode: "readwrite"
                })
                : "prompt";

        if (permission === "granted") {
            actorPhotoDirectoryHandle = handle;

            setPhotoStatus(
                "Acteursfotomap actief: " + handle.name,
                "success"
            );

            updatePhotoButton();
        } else {
            setPhotoStatus(
                "Fotomap onthouden: " +
                handle.name +
                ". Klik één keer op ‘Acteursfotomap kiezen’ om toestemming te geven."
            );
        }
    } catch (error) {
        console.error("Fotomap herstellen mislukt:", error);
    }
}


/* =========================================================
   RESULTATEN EN SELECTIE
========================================================= */

selectAllBtn.addEventListener("click", function () {
    document
        .querySelectorAll(".series-checkbox:not(:disabled)")
        .forEach(function (checkbox) {
            if (
                checkbox.closest(".series-card").style.display !== "none"
            ) {
                checkbox.checked = true;
            }
        });

    updateSelectionState();
});

clearSelectionBtn.addEventListener("click", function () {
    document
        .querySelectorAll(".series-checkbox")
        .forEach(function (checkbox) {
            checkbox.checked = false;
        });

    updateSelectionState();
});

hideImportedCheckbox.addEventListener(
    "change",
    refreshVisibleSeriesCards
);

function renderSeriesResults(title, series) {
    resultsTitle.textContent = title;
    resultsSubtitle.textContent =
        series.length +
        (series.length === 1 ? " serie gevonden" : " series gevonden");

    resultsList.innerHTML = "";

    if (series.length === 0) {
        resultsList.innerHTML =
            '<div class="empty-state">' +
            '<span>📺</span>' +
            '<strong>Geen series gevonden</strong>' +
            '</div>';

        selectionToolbar.classList.add("hidden");
        updateSelectionState();
        return;
    }

    series.forEach(function (item) {
        resultsList.appendChild(createSeriesCard(item));
    });

    selectionToolbar.classList.remove("hidden");
    refreshVisibleSeriesCards();
}

function createSeriesCard(series) {
    const card = document.createElement("div");
    card.className = "series-card";
    card.dataset.seriesId = String(series.id);

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "series-checkbox";
    checkbox.dataset.seriesId = String(series.id);
    checkbox.addEventListener("change", updateSelectionState);

    const info = document.createElement("div");
    info.className = "series-info";

    const heading = document.createElement("h3");
    heading.textContent =
        series.title + " (" + (series.year || "?") + ")";
    info.appendChild(heading);

    if (series.character) {
        const role = document.createElement("p");
        role.textContent = "Rol: " + series.character;
        info.appendChild(role);
    }

    if (isSeriesImported(series.id)) {
        checkbox.disabled = true;
        card.classList.add("imported");

        const label = document.createElement("span");
        label.className = "imported-label";
        label.textContent = "✅ Al in database";
        info.appendChild(label);
    }

    card.appendChild(checkbox);
    card.appendChild(info);

    return card;
}

function refreshVisibleSeriesCards() {
    const hideImported = hideImportedCheckbox.checked;

    document
        .querySelectorAll(".series-card")
        .forEach(function (card) {
            const seriesId = Number(card.dataset.seriesId);
            const imported = isSeriesImported(seriesId);
            const checkbox = card.querySelector(".series-checkbox");

            card.classList.toggle("imported", imported);

            if (checkbox) {
                checkbox.disabled = imported;

                if (imported) {
                    checkbox.checked = false;
                }
            }

            card.style.display =
                hideImported && imported ? "none" : "flex";
        });

    updateSelectionState();
}

function updateSelectionState() {
    const amount = document.querySelectorAll(
        ".series-checkbox:checked:not(:disabled)"
    ).length;

    const text =
        amount === 1
            ? "1 serie geselecteerd"
            : amount + " series geselecteerd";

    selectionCount.textContent = text;
    batchSelectionCount.textContent = text;
    addSelectedBtn.disabled = amount === 0;
    batchBar.classList.toggle("hidden", amount === 0);
}

function isSeriesImported(seriesId) {
    return importedSeries.some(function (series) {
        return Number(series.id) === Number(seriesId);
    });
}


/* =========================================================
   SERIES TOEVOEGEN
========================================================= */

addSelectedBtn.addEventListener("click", addSelectedSeries);

async function addSelectedSeries() {
    if (!databaseActive) {
        alert("Laad eerst een database of klik op ‘Nieuwe database’.");
        return;
    }

    const selectedCheckboxes = Array.from(
        document.querySelectorAll(
            ".series-checkbox:checked:not(:disabled)"
        )
    );

    if (selectedCheckboxes.length === 0) {
        return;
    }

    setBusy(true);

    let added = 0;
    let skipped = 0;
    let failed = 0;

    const photoTotals = {
        downloaded: 0,
        existing: 0,
        missing: 0,
        failed: 0
    };

    try {
        for (
            let index = 0;
            index < selectedCheckboxes.length;
            index++
        ) {
            const seriesId = Number(
                selectedCheckboxes[index].dataset.seriesId
            );

            const knownSeries = availableSeries.get(seriesId);

            batchProgressText.textContent =
                (index + 1) +
                " van " +
                selectedCheckboxes.length +
                " · " +
                (knownSeries ? knownSeries.title : "serie ophalen");

            if (isSeriesImported(seriesId)) {
                skipped++;
                continue;
            }

            try {
                const details = await getSeriesDetails(seriesId);

                if (actorPhotoDirectoryHandle) {
                    batchProgressText.textContent =
                        (index + 1) +
                        " van " +
                        selectedCheckboxes.length +
                        " · castfoto’s opslaan voor " +
                        details.title;

                    const photoResult =
                        await saveSeriesCastPhotos(details.cast);

                    photoTotals.downloaded += photoResult.downloaded;
                    photoTotals.existing += photoResult.existing;
                    photoTotals.missing += photoResult.missing;
                    photoTotals.failed += photoResult.failed;
                }

                importedSeries.push(details);
                lastAddedSeries = details;
                added++;

                refreshDatabasePanel();
                refreshVisibleSeriesCards();
                saveActiveDatabase();
            } catch (error) {
                console.error(
                    "Serie toevoegen mislukt:",
                    seriesId,
                    error
                );

                failed++;
            }
        }

        saveActiveDatabase();
        refreshDatabasePanel();
        refreshVisibleSeriesCards();

        let message =
            "Klaar!\\n\\n" +
            "Toegevoegd: " + added + "\\n" +
            "Al aanwezig: " + skipped + "\\n" +
            "Mislukt: " + failed;

        if (actorPhotoDirectoryHandle) {
            message +=
                "\\n\\nCastfoto’s:" +
                "\\nNieuw opgeslagen: " + photoTotals.downloaded +
                "\\nStonden al in map: " + photoTotals.existing +
                "\\nGeen TMDB-foto: " + photoTotals.missing +
                "\\nOpslaan mislukt: " + photoTotals.failed;
        } else if (added > 0) {
            message +=
                "\\n\\nGeen acteursfotomap actief." +
                "\\nDe castgegevens zijn wel volledig opgeslagen.";
        }

        alert(message);
    } finally {
        setBusy(false);
        updateSelectionState();
        showSearchTab(activeSearchTab);
    }
}

async function saveSeriesCastPhotos(cast) {
    const totals = {
        downloaded: 0,
        existing: 0,
        missing: 0,
        failed: 0
    };

    if (
        !actorPhotoDirectoryHandle ||
        !Array.isArray(cast)
    ) {
        return totals;
    }

    for (const castMember of cast) {
        const result = await saveActorPhotoCandidate(castMember);

        if (Object.prototype.hasOwnProperty.call(totals, result)) {
            totals[result]++;
        } else {
            totals.failed++;
        }
    }

    return totals;
}

async function getSeriesDetails(seriesId) {
    const response = await fetch(
        "https://api.themoviedb.org/3/tv/" +
        seriesId +
        "?api_key=" + TMDB_API_KEY +
        "&language=nl-NL" +
        "&append_to_response=aggregate_credits"
    );

    if (!response.ok) {
        throw new Error("HTTP " + response.status);
    }

    const details = await response.json();
    const aggregateCredits =
        details.aggregate_credits || { cast: [], crew: [] };

    const mainCast = (aggregateCredits.cast || [])
        .filter(function (person) {
            return person && person.id && person.name;
        })
        .sort(function (a, b) {
            const orderA =
                Number.isFinite(Number(a.order))
                    ? Number(a.order)
                    : 9999;

            const orderB =
                Number.isFinite(Number(b.order))
                    ? Number(b.order)
                    : 9999;

            if (orderA !== orderB) {
                return orderA - orderB;
            }

            return (b.popularity || 0) - (a.popularity || 0);
        })
        .slice(0, SERIES_CAST_LIMIT)
        .map(function (person, index) {
            const roles = Array.isArray(person.roles)
                ? person.roles
                    .map(function (role) {
                        return role.character;
                    })
                    .filter(Boolean)
                : [];

            const primaryCharacter =
                roles[0] ||
                person.character ||
                "";

            return {
                id: Number(person.id),
                name: person.name,
                character: primaryCharacter,
                characters: Array.from(new Set(roles)),
                order: Number.isFinite(Number(person.order))
                    ? Number(person.order)
                    : index,
                popularity: Number(person.popularity || 0),
                profile_path: person.profile_path || null,
                photo: createActorPhotoFilename(person.name)
            };
        });

    const creators = (details.created_by || [])
        .map(function (person) {
            return person.name;
        })
        .filter(Boolean);

    return {
        id: Number(details.id),
        media_type: "tv",
        title: details.name,
        original_title: details.original_name || details.name,
        year: details.first_air_date
            ? Number(details.first_air_date.slice(0, 4))
            : null,
        first_air_date: details.first_air_date || "",
        last_air_date: details.last_air_date || "",
        status: details.status || "",
        number_of_seasons: Number(details.number_of_seasons || 0),
        number_of_episodes: Number(details.number_of_episodes || 0),
        genre: (details.genres || []).map(function (genre) {
            return genre.name;
        }),
        creators: creators,
        director: creators,
        cast: mainCast,
        actors: mainCast.map(function (person) {
            return person.name;
        }),
        characters: mainCast.map(function (person) {
            return person.character;
        }),
        networks: (details.networks || [])
            .map(function (network) {
                return network.name;
            })
            .filter(Boolean),
        poster_path: details.poster_path || null,
        backdrop_path: details.backdrop_path || null,
        fullDetails: true
    };
}


/* =========================================================
   UI EN OPSLAG
========================================================= */

function setBusy(isBusy) {
    searchBtn.disabled = isBusy;
    actorSearchBtn.disabled = isBusy;
    seriesTabBtn.disabled = isBusy;
    actorTabBtn.disabled = isBusy;
    choosePhotoFolderBtn.disabled = isBusy;
    saveActorPhotoBtn.disabled =
        isBusy || !(selectedActor && actorPhotoDirectoryHandle);
    newDatabaseBtn.disabled = isBusy;
    loadDatabaseInput.disabled = isBusy;
    selectAllBtn.disabled = isBusy;
    clearSelectionBtn.disabled = isBusy;

    exportBtn.disabled = isBusy || !databaseActive;
    addSelectedBtn.disabled = isBusy;
}

function refreshDatabasePanel() {
    databaseCount.textContent = String(importedSeries.length);
    exportBtn.disabled = !databaseActive;

    lastAddedSeriesElement.textContent =
        lastAddedSeries
            ? (
                lastAddedSeries.title +
                " (" +
                (lastAddedSeries.year || "?") +
                ")"
            )
            : (
                databaseActive
                    ? "Database actief"
                    : "Nog niets toegevoegd"
            );

    recentSeriesList.innerHTML = "";

    if (!databaseActive) {
        const item = document.createElement("li");
        item.className = "muted-item";
        item.textContent = "Nog geen database actief.";
        recentSeriesList.appendChild(item);
        return;
    }

    if (importedSeries.length === 0) {
        const item = document.createElement("li");
        item.className = "muted-item";
        item.textContent = "De actieve database is nog leeg.";
        recentSeriesList.appendChild(item);
        return;
    }

    importedSeries
        .slice(-25)
        .reverse()
        .forEach(function (series) {
            const item = document.createElement("li");
            item.textContent =
                series.title + " (" + (series.year || "?") + ")";

            recentSeriesList.appendChild(item);
        });
}

function setDatabaseStatus(message, state) {
    databaseStatus.textContent = message;
    databaseStatus.className =
        "info-box" + (state ? " " + state : "");
}

function saveActiveDatabase() {
    try {
        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({
                active: databaseActive,
                series: importedSeries,
                fileName: loadedDatabaseFileName
            })
        );
    } catch (error) {
        console.error("TV-database lokaal opslaan mislukt:", error);
    }
}

function restoreActiveDatabase() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);

        if (!raw) {
            return;
        }

        const saved = JSON.parse(raw);

        if (
            !saved ||
            !saved.active ||
            !Array.isArray(saved.series)
        ) {
            return;
        }

        importedSeries = deduplicateSeries(saved.series);
        loadedDatabaseFileName =
            saved.fileName || "moviemind_tv_database.json";

        databaseActive = true;
        lastAddedSeries = null;

        refreshDatabasePanel();

        setDatabaseStatus(
            importedSeries.length +
            " series uit de lokaal onthouden database hersteld.",
            "success"
        );
    } catch (error) {
        console.error("TV-database herstellen mislukt:", error);
    }
}


/* =========================================================
   HULPFUNCTIES
========================================================= */

function mapSearchSeries(item) {
    return {
        id: Number(item.id),
        media_type: "tv",
        title: item.name,
        original_title: item.original_name || item.name,
        year: item.first_air_date
            ? Number(item.first_air_date.slice(0, 4))
            : null,
        first_air_date: item.first_air_date || "",
        popularity: item.popularity || 0,
        fullDetails: false
    };
}

function cacheSeries(series) {
    series.forEach(function (item) {
        availableSeries.set(Number(item.id), item);
    });
}

function deduplicateSeries(series) {
    const unique = new Map();

    series.forEach(function (item) {
        if (
            !item ||
            item.id === undefined ||
            !item.title
        ) {
            return;
        }

        const normalized = {
            ...item,
            id: Number(item.id),
            media_type: "tv"
        };

        normalized.cast = normalizeSeriesCast(normalized);

        normalized.actors = normalized.cast.map(function (person) {
            return person.name;
        });

        normalized.characters = normalized.cast.map(function (person) {
            return person.character;
        });

        unique.set(Number(normalized.id), normalized);
    });

    return Array.from(unique.values());
}

function normalizeSeriesCast(series) {
    if (Array.isArray(series.cast)) {
        return series.cast
            .filter(function (person) {
                return person && person.name;
            })
            .slice(0, SERIES_CAST_LIMIT)
            .map(function (person, index) {
                return {
                    id:
                        person.id !== undefined && person.id !== null
                            ? Number(person.id)
                            : null,
                    name: person.name,
                    character: person.character || "",
                    characters: Array.isArray(person.characters)
                        ? person.characters.filter(Boolean)
                        : (
                            person.character
                                ? [person.character]
                                : []
                        ),
                    order:
                        Number.isFinite(Number(person.order))
                            ? Number(person.order)
                            : index,
                    popularity: Number(person.popularity || 0),
                    profile_path: person.profile_path || null,
                    photo:
                        person.photo ||
                        createActorPhotoFilename(person.name)
                };
            });
    }

    const actors = Array.isArray(series.actors)
        ? series.actors
        : [];

    const characters = Array.isArray(series.characters)
        ? series.characters
        : [];

    return actors
        .slice(0, SERIES_CAST_LIMIT)
        .filter(Boolean)
        .map(function (actorName, index) {
            const character = characters[index] || "";

            return {
                id: null,
                name: actorName,
                character: character,
                characters: character ? [character] : [],
                order: index,
                popularity: 0,
                profile_path: null,
                photo: createActorPhotoFilename(actorName)
            };
        });
}

function isAllowedTvActorCredit(item) {
    if (
        !item ||
        !item.id ||
        !item.name ||
        !item.first_air_date
    ) {
        return false;
    }

    const title =
        String(item.name || "").toLowerCase();

    const character =
        String(item.character || "").toLowerCase();

    const unwantedCharacters = [
        "self",
        "himself",
        "herself",
        "themselves",
        "narrator",
        "voice narrator",
        "host",
        "presenter",
        "archive footage",
        "archival footage",
        "guest host",
        "panelist",
        "judge"
    ];

    const unwantedTitles = [
        "making of",
        "behind the scenes",
        "aftershow",
        "after show",
        "talk show",
        "reunion",
        "special features",
        "bonus material",
        "red carpet",
        "award show",
        "awards",
        "documentary special"
    ];

    return (
        !unwantedCharacters.some(function (itemText) {
            return character.includes(itemText);
        }) &&
        !unwantedTitles.some(function (itemText) {
            return title.includes(itemText);
        })
    );
}


function normalizeText(text) {
    return String(text || "")
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
}


function restoreSearchTab() {
    let savedTab = "series";

    try {
        savedTab =
            localStorage.getItem(ACTIVE_TAB_KEY) ||
            "series";
    } catch (error) {
        console.warn(
            "Actieve zoektab herstellen mislukt:",
            error
        );
    }

    showSearchTab(
        savedTab === "actor"
            ? "actor"
            : "series"
    );
}


/* =========================================================
   BEGINSTATUS
========================================================= */

refreshDatabasePanel();
updateSelectionState();
restoreSearchTab();

if (seriesSuggestions) {
    seriesSuggestions.innerHTML = "";
}

if (actorSuggestions) {
    actorSuggestions.innerHTML = "";
}

restoreActiveDatabase();
restorePhotoFolder();