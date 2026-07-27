/* =========================================================
   MOVIEMIND STUDIO
   Hoofdscript
   Versie 0.17.2
========================================================= */

"use strict";

var movieMindState = {
    records: [],
    filteredItems: [],
    view: "films",
    currentPage: 1,
    resultsPerPage: 20,
    databaseFileHandle: null
};

var studioPhotoState = {
    directoryHandle: null,
    selectedActor: null,
    selectedCandidate: null,
    previewObjectUrl: null,
    requestId: 0
};

document.addEventListener("DOMContentLoaded", function () {
    prepareExistingInterface();
    initialiseRecentTitleChanges();
    initialiseMaintenancePanel();
    initialiseDatabaseLoader();
    initialiseDatabaseMerger();
    initialiseSearch();
    initialiseNavigation();
    initialiseStudioPhotoManager();
    initialiseMissingPhotosFiller();
    initialiseMovieImporter();
    initialiseTvSeriesImporter();
    showEmptyState("Database wordt gecontroleerd...");
    restoreStudioConnections();
});


/* =========================================================
   BESTAANDE HTML ROBUUST VOORBEREIDEN
========================================================= */

function prepareExistingInterface() {
    var searchButton = document.querySelector(".search-button");
    var resultsBody = document.querySelector(".results-table tbody");
    var pagination = document.querySelector(".pagination");
    var resultsHeadingCount = document.querySelector(
        ".section-heading-row h3 span"
    );

    if (searchButton && !searchButton.id) {
        searchButton.id = "search-button";
    }

    if (resultsBody && !resultsBody.id) {
        resultsBody.id = "results-body";
    }

    if (pagination && !pagination.id) {
        pagination.id = "results-pagination";
    }

    if (resultsHeadingCount && !resultsHeadingCount.id) {
        resultsHeadingCount.id = "results-count";
    }

    setSelectValues();
}


function setSelectValues() {
    var searchScope = document.getElementById("search-scope");
    var searchType = document.getElementById("search-type");

    if (searchScope) {
        setOptionValue(searchScope, "Alle titels", "all");
        setOptionValue(searchScope, "Films", "movies");
        setOptionValue(searchScope, "TV-series", "series");
        setOptionValue(searchScope, "Acteurs", "actors");
    }

    if (searchType) {
        setOptionValue(searchType, "Alle", "all");
        setOptionValue(searchType, "Film", "movie");
        setOptionValue(searchType, "Serie", "tv");
    }
}


function setOptionValue(selectElement, optionText, value) {
    var options = selectElement.options;
    var index;

    for (index = 0; index < options.length; index += 1) {
        if (options[index].text.trim() === optionText) {
            options[index].value = value;
        }
    }
}


/* =========================================================
   INKLAPBAAR ONDERHOUDSMENU
========================================================= */

function initialiseMaintenancePanel() {
    var maintenancePanel = document.getElementById("maintenance-panel");
    var maintenanceToggle = document.getElementById("maintenance-toggle");
    var maintenanceLabel = null;

    if (maintenanceToggle) {
        maintenanceLabel = maintenanceToggle.querySelector(
            ".maintenance-toggle-label"
        );
    }

    if (!maintenancePanel || !maintenanceToggle) {
        return;
    }

    maintenanceToggle.addEventListener("click", function () {
        var isCollapsed = maintenancePanel.classList.toggle("is-collapsed");
        var isExpanded = !isCollapsed;

        maintenanceToggle.setAttribute(
            "aria-expanded",
            String(isExpanded)
        );

        maintenanceToggle.title = isExpanded
            ? "Onderhoudsmenu sluiten"
            : "Onderhoudsmenu openen";

        if (maintenanceLabel) {
            maintenanceLabel.textContent = isExpanded
                ? "Sluiten"
                : "Openen";
        }
    });
}


/* =========================================================
   VASTE KOPPELINGEN - VERSIE 0.15
========================================================= */

var STUDIO_SETTINGS_DB = "MovieMindStudioSettings";
var STUDIO_SETTINGS_STORE = "handles";

function openStudioSettingsDatabase() {
    return new Promise(function (resolve, reject) {
        var request = indexedDB.open(STUDIO_SETTINGS_DB, 1);

        request.onupgradeneeded = function () {
            if (!request.result.objectStoreNames.contains(STUDIO_SETTINGS_STORE)) {
                request.result.createObjectStore(STUDIO_SETTINGS_STORE);
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

async function saveStudioHandle(key, handle) {
    var database = await openStudioSettingsDatabase();

    return new Promise(function (resolve, reject) {
        var transaction = database.transaction(STUDIO_SETTINGS_STORE, "readwrite");
        transaction.objectStore(STUDIO_SETTINGS_STORE).put(handle, key);
        transaction.oncomplete = function () {
            database.close();
            resolve();
        };
        transaction.onerror = function () {
            database.close();
            reject(transaction.error);
        };
    });
}

async function getStudioHandle(key) {
    var database = await openStudioSettingsDatabase();

    return new Promise(function (resolve, reject) {
        var transaction = database.transaction(STUDIO_SETTINGS_STORE, "readonly");
        var request = transaction.objectStore(STUDIO_SETTINGS_STORE).get(key);
        request.onsuccess = function () {
            database.close();
            resolve(request.result || null);
        };
        request.onerror = function () {
            database.close();
            reject(request.error);
        };
    });
}

async function queryStudioHandlePermission(handle, mode) {
    if (!handle) {
        return false;
    }

    if (!handle.queryPermission) {
        return true;
    }

    return await handle.queryPermission({ mode: mode }) === "granted";
}

async function restoreStudioConnections() {
    var databaseHandle = null;
    var actorFolderHandle = null;
    var databaseRestored = false;

    try {
        databaseHandle = await getStudioHandle("database");
        actorFolderHandle = await getStudioHandle("actorsFolder");

        if (databaseHandle && await queryStudioHandlePermission(databaseHandle, "read")) {
            movieMindState.databaseFileHandle = databaseHandle;
            await loadDatabaseFromHandle(databaseHandle, false);
            databaseRestored = true;
        }

        if (actorFolderHandle && await queryStudioHandlePermission(actorFolderHandle, "readwrite")) {
            studioPhotoState.directoryHandle = actorFolderHandle;
            setStudioPhotoStatus(
                "Acteursfotomap automatisch gekoppeld: " + actorFolderHandle.name,
                "success"
            );
            updateStudioPhotoSaveButton();
        }
    } catch (error) {
        console.warn("Vaste koppelingen herstellen mislukt:", error);
    }

    if (!databaseRestored) {
        showEmptyState("Laad eenmalig de MovieMind-database. Daarna wordt deze onthouden.");
    }
}

async function loadDatabaseFromHandle(handle, requestPermission) {
    var permission = await queryStudioHandlePermission(handle, "read");

    if (!permission && requestPermission && handle.requestPermission) {
        permission = await handle.requestPermission({ mode: "read" }) === "granted";
    }

    if (!permission) {
        showNotification(
            "Klik eenmaal op Database laden om de opgeslagen database opnieuw toestemming te geven.",
            "error"
        );
        return false;
    }

    loadDatabaseFile(await handle.getFile());
    return true;
}


/* =========================================================
   DATABASE LADEN
========================================================= */

function initialiseDatabaseLoader() {
    var loadButton = document.getElementById("load-database-button");
    var fileInput = document.getElementById("database-file-input");

    if (!loadButton || !fileInput) {
        console.error(
            "Databaseknop of bestandsveld ontbreekt in index.html."
        );
        return;
    }

    loadButton.addEventListener("click", async function () {
        if ("showOpenFilePicker" in window) {
            try {
                var handles = await window.showOpenFilePicker({
                    multiple: false,
                    types: [{
                        description: "MovieMind database",
                        accept: { "application/json": [".json"] }
                    }]
                });

                if (!handles || !handles[0]) {
                    return;
                }

                movieMindState.databaseFileHandle = handles[0];
                await saveStudioHandle("database", handles[0]);
                await loadDatabaseFromHandle(handles[0], true);
                return;
            } catch (error) {
                if (error && error.name === "AbortError") {
                    return;
                }
                console.warn("Bestandskiezer via browser mislukt:", error);
            }
        }

        fileInput.value = "";
        fileInput.click();
    });

    fileInput.addEventListener("change", function () {
        var file = fileInput.files[0];

        if (!file) {
            return;
        }

        movieMindState.databaseFileHandle = null;
        loadDatabaseFile(file);
    });
}

function loadDatabaseFile(file) {
    var reader = new FileReader();
    var loadButton = document.getElementById("load-database-button");

    setLoadButtonState(loadButton, true);

    if (!file.name.toLowerCase().endsWith(".json")) {
        handleLoadError(
            "Kies een databasebestand met de extensie .json.",
            loadButton
        );
        return;
    }

    reader.onload = function (event) {
        try {
            var fileText = String(event.target.result || "");
            var parsedDatabase;
            var records;

            if (!fileText.trim()) {
                throw new Error("Het gekozen bestand is leeg.");
            }

            parsedDatabase = JSON.parse(fileText);
            records = extractRecords(parsedDatabase);

            if (records.length === 0) {
                throw new Error(
                    "In dit JSON-bestand zijn geen films of series gevonden."
                );
            }

            window.movieMindDatabase = parsedDatabase;
            window.movieMindDatabaseFileName = file.name;

            movieMindState.records = records;
            movieMindState.currentPage = 1;

            updateLastLoaded(file.name);
            updateDatabaseStatistics(records);
            addLogEntry("Database geladen: " + file.name);

            showNotification(
                records.length.toLocaleString("nl-NL") +
                    " titels succesvol geladen.",
                "success"
            );

            applyCurrentView();
        } catch (error) {
            handleLoadError(
                error.message || "De database kon niet worden geladen.",
                loadButton
            );
            return;
        }

        setLoadButtonState(loadButton, false);
    };

    reader.onerror = function () {
        handleLoadError(
            "Het bestand kon niet worden gelezen.",
            loadButton
        );
    };

    reader.readAsText(file);
}


function extractRecords(database) {
    var records = [];

    if (Array.isArray(database)) {
        records = database;
    } else if (database && Array.isArray(database.films)) {
        records = database.films;
    } else if (database && Array.isArray(database.titles)) {
        records = database.titles;
    }

    return records.filter(function (record) {
        return record && typeof record === "object";
    });
}


function handleLoadError(message, loadButton) {
    console.error(message);
    addLogEntry("Database laden mislukt");
    showNotification(message, "error");
    setLoadButtonState(loadButton, false);
}


function setLoadButtonState(button, isLoading) {
    if (!button) {
        return;
    }

    button.disabled = isLoading;
    button.classList.toggle("is-loading", isLoading);

    button.textContent = isLoading
        ? "Database laden..."
        : "Database laden";
}


/* =========================================================
   FILM- EN TV-DATABASE SAMENVOEGEN - VERSIE 0.16
========================================================= */

function initialiseDatabaseMerger() {
    var mergeButton = document.getElementById("merge-databases-button");

    if (!mergeButton) {
        return;
    }

    mergeButton.addEventListener("click", async function () {
        var originalText = mergeButton.textContent;

        try {
            setMergeButtonState(mergeButton, true);

            var filmFile = await chooseJsonFile(
                "Kies eerst de bestaande filmdatabase"
            );

            if (!filmFile) {
                return;
            }

            var tvFile = await chooseJsonFile(
                "Kies nu de bestaande TV-database"
            );

            if (!tvFile) {
                return;
            }

            var filmDatabase = await readJsonFile(filmFile);
            var tvDatabase = await readJsonFile(tvFile);
            var mergeResult = mergeMovieMindDatabases(
                filmDatabase,
                tvDatabase
            );

            var databaseText = JSON.stringify(
                mergeResult.database,
                null,
                2
            );

            var savedHandle = await saveCombinedDatabase(databaseText);

            window.movieMindDatabase = mergeResult.database;
            window.movieMindDatabaseFileName = "moviemind_database.json";
            movieMindState.records = mergeResult.database.films;
            movieMindState.currentPage = 1;

            if (savedHandle) {
                movieMindState.databaseFileHandle = savedHandle;
                window.movieMindDatabaseFileName = savedHandle.name;
                await saveStudioHandle("database", savedHandle);
            }

            updateLastLoaded(window.movieMindDatabaseFileName);
            updateDatabaseStatistics(movieMindState.records);
            applyCurrentView();

            addLogEntry(
                "Databases samengevoegd: " +
                mergeResult.movieCount.toLocaleString("nl-NL") +
                " films en " +
                mergeResult.tvCount.toLocaleString("nl-NL") +
                " series"
            );

            showNotification(
                "Klaar: " +
                mergeResult.totalCount.toLocaleString("nl-NL") +
                " titels opgeslagen in moviemind_database.json. " +
                mergeResult.skippedDuplicates.toLocaleString("nl-NL") +
                " dubbele serie(s) zijn overgeslagen.",
                "success"
            );
        } catch (error) {
            if (error && error.name === "AbortError") {
                return;
            }

            console.error("Databases samenvoegen mislukt:", error);
            showNotification(
                error.message || "De databases konden niet worden samengevoegd.",
                "error"
            );
        } finally {
            setMergeButtonState(mergeButton, false, originalText);
        }
    });
}

async function chooseJsonFile(description) {
    if ("showOpenFilePicker" in window) {
        var handles = await window.showOpenFilePicker({
            multiple: false,
            types: [{
                description: description,
                accept: { "application/json": [".json"] }
            }]
        });

        if (!handles || !handles[0]) {
            return null;
        }

        return await handles[0].getFile();
    }

    return await chooseJsonFileWithInput();
}

function chooseJsonFileWithInput() {
    return new Promise(function (resolve) {
        var input = document.createElement("input");

        input.type = "file";
        input.accept = ".json,application/json";
        input.className = "visually-hidden";
        document.body.appendChild(input);

        input.addEventListener("change", function () {
            var file = input.files && input.files[0]
                ? input.files[0]
                : null;

            input.remove();
            resolve(file);
        }, { once: true });

        input.click();
    });
}

async function readJsonFile(file) {
    var text;

    if (!file || !file.name.toLowerCase().endsWith(".json")) {
        throw new Error("Kies een geldig JSON-databasebestand.");
    }

    text = await file.text();

    if (!text.trim()) {
        throw new Error(file.name + " is leeg.");
    }

    try {
        return JSON.parse(text);
    } catch (error) {
        throw new Error(file.name + " bevat geen geldige JSON.");
    }
}

function mergeMovieMindDatabases(filmDatabase, tvDatabase) {
    var filmRecords = extractRecords(filmDatabase);
    var tvRecords = extractTvRecords(tvDatabase);
    var combinedRecords = [];
    var existingTvKeys = new Set();
    var skippedDuplicates = 0;

    if (filmRecords.length === 0) {
        throw new Error("In de gekozen filmdatabase zijn geen titels gevonden.");
    }

    if (tvRecords.length === 0) {
        throw new Error("In de gekozen TV-database zijn geen series gevonden.");
    }

    filmRecords.forEach(function (record) {
        var cleanRecord = Object.assign({}, record);

        if (cleanRecord.media_type !== "tv") {
            cleanRecord.media_type = "movie";
        }

        combinedRecords.push(cleanRecord);

        if (cleanRecord.media_type === "tv") {
            existingTvKeys.add(createRecordKey(cleanRecord));
        }
    });

    tvRecords.forEach(function (record) {
        var cleanRecord = Object.assign({}, record, {
            media_type: "tv"
        });
        var key = createRecordKey(cleanRecord);

        if (existingTvKeys.has(key)) {
            skippedDuplicates += 1;
            return;
        }

        existingTvKeys.add(key);
        combinedRecords.push(cleanRecord);
    });

    var movieCount = combinedRecords.filter(function (record) {
        return record.media_type !== "tv";
    }).length;
    var tvCount = combinedRecords.filter(function (record) {
        return record.media_type === "tv";
    }).length;

    return {
        database: {
            database_type: "moviemind_combined",
            version: 1,
            films: combinedRecords
        },
        movieCount: movieCount,
        tvCount: tvCount,
        totalCount: combinedRecords.length,
        skippedDuplicates: skippedDuplicates
    };
}

function extractTvRecords(database) {
    if (database && Array.isArray(database.series)) {
        return database.series.filter(function (record) {
            return record && typeof record === "object";
        });
    }

    return extractRecords(database).filter(function (record) {
        return record.media_type === "tv";
    });
}

function createRecordKey(record) {
    var idPart = record.id === null || record.id === undefined
        ? ""
        : String(record.id);
    var titlePart = normaliseText(String(record.title || ""));

    return idPart + "|" + titlePart;
}

async function saveCombinedDatabase(databaseText) {
    if ("showSaveFilePicker" in window) {
        var handle = await window.showSaveFilePicker({
            suggestedName: "moviemind_database.json",
            types: [{
                description: "MovieMind gecombineerde database",
                accept: { "application/json": [".json"] }
            }]
        });
        var writable = await handle.createWritable();

        await writable.write(databaseText);
        await writable.close();
        return handle;
    }

    var blob = new Blob([databaseText], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");

    link.href = url;
    link.download = "moviemind_database.json";
    document.body.appendChild(link);
    link.click();
    link.remove();

    window.setTimeout(function () {
        URL.revokeObjectURL(url);
    }, 1000);

    return null;
}

function setMergeButtonState(button, isLoading, originalText) {
    if (!button) {
        return;
    }

    button.disabled = isLoading;
    button.classList.toggle("is-loading", isLoading);

    if (isLoading) {
        button.textContent = "Databases samenvoegen...";
    } else if (originalText) {
        button.textContent = originalText;
    } else {
        button.innerHTML = '<span aria-hidden="true">🔗</span> Film- en TV-database samenvoegen';
    }
}


/* =========================================================
   LINKERNAVIGATIE
========================================================= */

function initialiseNavigation() {
    var navigationButtons = document.querySelectorAll(".nav-button");

    navigationButtons.forEach(function (button) {
        button.addEventListener("click", function () {
            var requestedView = button.getAttribute("data-view");

            if (
                requestedView !== "films" &&
                requestedView !== "series" &&
                requestedView !== "actors"
            ) {
                return;
            }

            navigationButtons.forEach(function (navButton) {
                navButton.classList.remove("is-active");
            });

            button.classList.add("is-active");
            movieMindState.view = requestedView;
            movieMindState.currentPage = 1;

            synchroniseFiltersWithView();
            updateViewHeadings();
            applyCurrentView();
        });
    });
}


function synchroniseFiltersWithView() {
    var searchScope = document.getElementById("search-scope");
    var searchType = document.getElementById("search-type");

    if (!searchScope || !searchType) {
        return;
    }

    if (movieMindState.view === "films") {
        searchScope.value = "movies";
        searchType.value = "movie";
        searchType.disabled = false;
    } else if (movieMindState.view === "series") {
        searchScope.value = "series";
        searchType.value = "tv";
        searchType.disabled = false;
    } else {
        searchScope.value = "actors";
        searchType.value = "all";
        searchType.disabled = true;
    }
}


function updateViewHeadings() {
    var workspaceTitle = document.querySelector(
        ".studio-workspace .panel-heading h2"
    );
    var resultsTitle = document.querySelector(
        ".section-heading-row h3"
    );

    if (workspaceTitle) {
        if (movieMindState.view === "films") {
            workspaceTitle.textContent = "Film zoeken";
        } else if (movieMindState.view === "series") {
            workspaceTitle.textContent = "TV-serie zoeken";
        } else {
            workspaceTitle.textContent = "Acteur zoeken";
        }
    }

    if (resultsTitle) {
        resultsTitle.innerHTML =
            getViewListTitle() +
            ' <span id="results-count">(0)</span>';
    }

    updateTableHeaders();
}


function getViewListTitle() {
    if (movieMindState.view === "series") {
        return "TV-serielijst";
    }

    if (movieMindState.view === "actors") {
        return "Acteurlijst";
    }

    return "Filmlijst";
}


function updateTableHeaders() {
    var headers = document.querySelectorAll(".results-table thead th");

    if (headers.length < 4) {
        return;
    }

    if (movieMindState.view === "actors") {
        headers[0].textContent = "Acteur";
        headers[1].textContent = "Films";
        headers[2].textContent = "Series";
        headers[3].textContent = "Totaal";
    } else {
        headers[0].textContent = "Titel";
        headers[1].textContent = "Jaar";
        headers[2].textContent = "Type";
        headers[3].textContent = "Acteurs";
    }
}


/* =========================================================
   ZOEKEN EN FILTEREN
========================================================= */

function initialiseSearch() {
    var searchInput = document.getElementById("main-search");
    var searchButton = document.getElementById("search-button");
    var searchScope = document.getElementById("search-scope");
    var searchType = document.getElementById("search-type");

    if (!searchInput || !searchButton || !searchScope || !searchType) {
        console.error("Een of meer zoekonderdelen ontbreken.");
        return;
    }

    searchInput.addEventListener("input", function () {
        movieMindState.currentPage = 1;
        applyCurrentView();
    });

    searchInput.addEventListener("keydown", function (event) {
        if (event.key === "Enter") {
            event.preventDefault();
            movieMindState.currentPage = 1;
            applyCurrentView();
        }
    });

    searchButton.addEventListener("click", function () {
        movieMindState.currentPage = 1;
        applyCurrentView();
    });

    searchScope.addEventListener("change", function () {
        var value = searchScope.value;

        if (value === "movies") {
            setActiveView("films");
        } else if (value === "series") {
            setActiveView("series");
        } else if (value === "actors") {
            setActiveView("actors");
        } else {
            movieMindState.currentPage = 1;
            applyCurrentView();
        }
    });

    searchType.addEventListener("change", function () {
        movieMindState.currentPage = 1;
        applyCurrentView();
    });
}


function setActiveView(view) {
    var buttons = document.querySelectorAll(".nav-button");

    movieMindState.view = view;
    movieMindState.currentPage = 1;

    buttons.forEach(function (button) {
        button.classList.toggle(
            "is-active",
            button.getAttribute("data-view") === view
        );
    });

    synchroniseFiltersWithView();
    updateViewHeadings();
    applyCurrentView();
}


function applyCurrentView() {
    var queryInput = document.getElementById("main-search");
    var typeSelect = document.getElementById("search-type");
    var query = queryInput
        ? normaliseText(queryInput.value.trim())
        : "";
    var typeFilter = typeSelect
        ? typeSelect.value
        : "all";

    if (movieMindState.records.length === 0) {
        movieMindState.filteredItems = [];
        showEmptyState("Laad eerst de MovieMind-database.");
        return;
    }

    if (movieMindState.view === "actors") {
        movieMindState.filteredItems = buildActorItems().filter(
            function (actor) {
                return (
                    !query ||
                    normaliseText(actor.name).indexOf(query) !== -1
                );
            }
        );

        movieMindState.filteredItems.sort(function (first, second) {
            return first.name.localeCompare(
                second.name,
                "nl",
                { sensitivity: "base" }
            );
        });
    } else {
        movieMindState.filteredItems = movieMindState.records.filter(
            function (record) {
                var recordType = getRecordType(record);

                if (
                    movieMindState.view === "films" &&
                    recordType !== "movie"
                ) {
                    return false;
                }

                if (
                    movieMindState.view === "series" &&
                    recordType !== "tv"
                ) {
                    return false;
                }

                if (
                    typeFilter !== "all" &&
                    recordType !== typeFilter
                ) {
                    return false;
                }

                return recordMatchesQuery(record, query);
            }
        );

        movieMindState.filteredItems.sort(function (first, second) {
            return String(first.title || "").localeCompare(
                String(second.title || ""),
                "nl",
                { sensitivity: "base" }
            );
        });
    }

    renderCurrentPage();
}


function recordMatchesQuery(record, query) {
    if (!query) {
        return true;
    }

    var searchableText = [
        record.title,
        record.year,
        joinValues(record.actors),
        joinValues(record.director),
        joinValues(record.genre),
        joinValues(record.characters)
    ].join(" ");

    return normaliseText(searchableText).indexOf(query) !== -1;
}


function buildActorItems() {
    var actorsByName = {};

    movieMindState.records.forEach(function (record) {
        var actors = Array.isArray(record.actors)
            ? record.actors
            : [];
        var recordType = getRecordType(record);

        actors.forEach(function (actorName) {
            var cleanName = String(actorName || "").trim();
            var key;

            if (!cleanName) {
                return;
            }

            key = normaliseText(cleanName);

            if (!actorsByName[key]) {
                actorsByName[key] = {
                    name: cleanName,
                    movies: 0,
                    series: 0,
                    total: 0
                };
            }

            if (recordType === "tv") {
                actorsByName[key].series += 1;
            } else {
                actorsByName[key].movies += 1;
            }

            actorsByName[key].total += 1;
        });
    });

    return Object.keys(actorsByName).map(function (key) {
        return actorsByName[key];
    });
}


/* =========================================================
   RESULTATEN EN PAGINERING
========================================================= */

function renderCurrentPage() {
    var totalResults = movieMindState.filteredItems.length;
    var totalPages = Math.max(
        1,
        Math.ceil(totalResults / movieMindState.resultsPerPage)
    );
    var startIndex;
    var endIndex;
    var pageItems;

    if (movieMindState.currentPage > totalPages) {
        movieMindState.currentPage = totalPages;
    }

    startIndex =
        (movieMindState.currentPage - 1) *
        movieMindState.resultsPerPage;
    endIndex = startIndex + movieMindState.resultsPerPage;
    pageItems = movieMindState.filteredItems.slice(
        startIndex,
        endIndex
    );

    renderResults(pageItems);
    renderPagination(totalPages);
}


function renderResults(items) {
    var resultsBody = document.getElementById("results-body");
    var resultsCount = document.getElementById("results-count");

    if (!resultsBody) {
        return;
    }

    resultsBody.innerHTML = "";

    if (resultsCount) {
        resultsCount.textContent =
            "(" +
            movieMindState.filteredItems.length.toLocaleString("nl-NL") +
            ")";
    }

    if (items.length === 0) {
        appendEmptyResultRow(
            resultsBody,
            "Geen resultaten gevonden."
        );
        return;
    }

    items.forEach(function (item) {
        if (movieMindState.view === "actors") {
            appendActorRow(resultsBody, item);
        } else {
            appendTitleRow(resultsBody, item);
        }
    });
}


function appendTitleRow(resultsBody, record) {
    var row = document.createElement("tr");

    appendCell(row, record.title || "Zonder titel");
    appendCell(row, record.year || "-");
    appendCell(
        row,
        getRecordType(record) === "tv" ? "Serie" : "Film"
    );
    appendCell(
        row,
        Array.isArray(record.actors)
            ? String(record.actors.length)
            : "0"
    );

    row.addEventListener("click", function () {
        selectResultRow(row);
        showTitleDetails(record);
    });

    resultsBody.appendChild(row);
}


function appendActorRow(resultsBody, actor) {
    var row = document.createElement("tr");

    appendCell(row, actor.name);
    appendCell(row, actor.movies);
    appendCell(row, actor.series);
    appendCell(row, actor.total);

    row.addEventListener("click", function () {
        selectResultRow(row);
        showActorDetails(actor);
    });

    resultsBody.appendChild(row);
}


function appendCell(row, value) {
    var cell = document.createElement("td");

    cell.textContent = String(value);
    row.appendChild(cell);
}


function selectResultRow(selectedRow) {
    var rows = document.querySelectorAll(
        "#results-body tr"
    );

    rows.forEach(function (row) {
        row.classList.remove("is-selected");
    });

    selectedRow.classList.add("is-selected");
}


function showEmptyState(message) {
    var resultsBody = document.getElementById("results-body");
    var resultsCount = document.getElementById("results-count");
    var pagination = document.getElementById("results-pagination");

    if (resultsBody) {
        resultsBody.innerHTML = "";
        appendEmptyResultRow(resultsBody, message);
    }

    if (resultsCount) {
        resultsCount.textContent = "(0)";
    }

    if (pagination) {
        pagination.innerHTML = "";
        appendPageButton(pagination, "1", 1, true, true);
    }
}


function appendEmptyResultRow(resultsBody, message) {
    var row = document.createElement("tr");
    var cell = document.createElement("td");

    row.className = "results-empty-row";
    cell.colSpan = 4;
    cell.textContent = message;
    cell.style.textAlign = "center";
    cell.style.padding = "28px 14px";
    cell.style.color = "#92877a";
    cell.style.fontStyle = "italic";

    row.appendChild(cell);
    resultsBody.appendChild(row);
}


function renderPagination(totalPages) {
    var pagination = document.getElementById("results-pagination");
    var pages;

    if (!pagination) {
        return;
    }

    pagination.innerHTML = "";

    if (movieMindState.filteredItems.length === 0) {
        appendPageButton(pagination, "1", 1, true, true);
        return;
    }

    appendPageButton(
        pagination,
        "<<",
        1,
        false,
        movieMindState.currentPage === 1
    );

    appendPageButton(
        pagination,
        "<",
        movieMindState.currentPage - 1,
        false,
        movieMindState.currentPage === 1
    );

    pages = getVisiblePageNumbers(
        movieMindState.currentPage,
        totalPages
    );

    pages.forEach(function (pageNumber) {
        appendPageButton(
            pagination,
            String(pageNumber),
            pageNumber,
            pageNumber === movieMindState.currentPage,
            false
        );
    });

    appendPageButton(
        pagination,
        ">",
        movieMindState.currentPage + 1,
        false,
        movieMindState.currentPage === totalPages
    );

    appendPageButton(
        pagination,
        ">>",
        totalPages,
        false,
        movieMindState.currentPage === totalPages
    );
}


function getVisiblePageNumbers(currentPage, totalPages) {
    var pages = [];
    var startPage = Math.max(1, currentPage - 2);
    var endPage = Math.min(totalPages, currentPage + 2);
    var pageNumber;

    if (currentPage <= 3) {
        endPage = Math.min(totalPages, 5);
    }

    if (currentPage >= totalPages - 2) {
        startPage = Math.max(1, totalPages - 4);
    }

    for (
        pageNumber = startPage;
        pageNumber <= endPage;
        pageNumber += 1
    ) {
        pages.push(pageNumber);
    }

    return pages;
}


function appendPageButton(
    container,
    label,
    targetPage,
    isActive,
    isDisabled
) {
    var button = document.createElement("button");

    button.type = "button";
    button.textContent = label;
    button.disabled = isDisabled;

    if (isActive) {
        button.classList.add("is-active");
    }

    button.addEventListener("click", function () {
        movieMindState.currentPage = targetPage;
        renderCurrentPage();
    });

    container.appendChild(button);
}


/* =========================================================
   EERSTE DETAILWEERGAVE
========================================================= */

async function showTitleDetails(record) {
    var title = document.querySelector(".selected-title h3");
    var year = document.querySelector(".selected-title p");
    var detailValues = document.querySelectorAll(".detail-list dd");
    var peopleGrid = document.querySelector(".people-grid");
    var directorRow = document.querySelector(".director-row");
    var genreList = document.querySelector(".genre-list");

    if (title) {
        title.textContent = record.title || "Zonder titel";
    }

    if (year) {
        year.textContent = record.year ? "(" + record.year + ")" : "";
    }

    renderTitlePoster(record);
    renderPeopleGrid(peopleGrid, record.actors, record.cast_details);
    renderDirectorRow(directorRow, record.director, record.director_details);
    renderGenreList(genreList, record.genre);
    updateTitleDetailValues(detailValues, record);

    if (!record.poster_path || !Array.isArray(record.cast_details)) {
        try {
            await enrichTitleRecordFromTmdb(record);
            renderTitlePoster(record);
            renderPeopleGrid(peopleGrid, record.actors, record.cast_details);
            renderDirectorRow(directorRow, record.director, record.director_details);
            updateTitleDetailValues(detailValues, record);
        } catch (error) {
            console.warn("Extra titelgegevens ophalen mislukt:", error);
        }
    }
}

function updateTitleDetailValues(detailValues, record) {
    if (detailValues.length < 6) {
        return;
    }

    detailValues[0].textContent = record.title || "-";
    detailValues[1].textContent = record.year || "-";
    detailValues[2].textContent = getRecordType(record) === "tv" ? "Serie" : "Film";
    detailValues[3].textContent = record.rating ? Number(record.rating).toFixed(1) : "-";
    detailValues[4].textContent = record.runtime ? record.runtime + " min" : (record.duration || "-");
    detailValues[5].textContent = record.id || "-";
}

function renderTitlePoster(record) {
    var image = document.getElementById("studio-title-poster");
    var placeholder = document.getElementById("studio-poster-placeholder");
    var path = record.poster_path || record.poster || "";

    if (!image || !placeholder) {
        return;
    }

    if (path) {
        image.src = path.indexOf("http") === 0 ? path : "https://image.tmdb.org/t/p/w500" + path;
        image.alt = "Poster van " + (record.title || "deze titel");
        image.hidden = false;
        image.style.display = "block";
        placeholder.hidden = true;
        placeholder.style.display = "none";
        image.onerror = function () {
            image.hidden = true;
            image.style.display = "none";
            placeholder.hidden = false;
            placeholder.style.display = "flex";
        };
    } else {
        image.removeAttribute("src");
        image.hidden = true;
        image.style.display = "none";
        placeholder.hidden = false;
        placeholder.style.display = "flex";
    }
}


async function showActorDetails(actor) {
    var title = document.querySelector(".selected-title h3");
    var year = document.querySelector(".selected-title p");
    var photoManager = document.getElementById("actor-photo-manager");

    if (title) {
        title.textContent = actor.name;
    }

    if (year) {
        year.textContent =
            actor.total +
            " titel" +
            (actor.total === 1 ? "" : "s");
    }

    if (photoManager) {
        photoManager.classList.add("is-visible");
    }

    await loadStudioActorPhotos(actor);
}


function renderPeopleGrid(container, actors, castDetails) {
    if (!container) {
        return;
    }

    container.innerHTML = "";

    (Array.isArray(actors) ? actors.slice(0, 8) : []).forEach(function (actorName, index) {
        var article = document.createElement("article");
        var photo;
        var name = document.createElement("p");
        var detail = Array.isArray(castDetails) ? castDetails[index] : null;

        article.className = "person-card";
        name.textContent = actorName;

        if (detail && detail.profile_path) {
            photo = document.createElement("img");
            photo.className = "person-photo-placeholder";
            photo.src = "https://image.tmdb.org/t/p/w185" + detail.profile_path;
            photo.alt = "Foto van " + actorName;
            photo.loading = "lazy";
        } else {
            photo = document.createElement("div");
            photo.className = "person-photo-placeholder";
            photo.textContent = "Foto";
        }

        article.appendChild(photo);
        article.appendChild(name);
        container.appendChild(article);
    });
}

function renderDirectorRow(container, directors, directorDetails) {
    var names;
    var firstDetail = Array.isArray(directorDetails) ? directorDetails[0] : null;
    var photoHtml;

    if (!container) {
        return;
    }

    names = Array.isArray(directors) ? directors.join(", ") : directors || "-";
    photoHtml = firstDetail && firstDetail.profile_path
        ? '<img class="person-photo-placeholder person-photo-small" src="https://image.tmdb.org/t/p/w185' + firstDetail.profile_path + '" alt="Foto van ' + escapeHtml(names) + '">'
        : '<div class="person-photo-placeholder person-photo-small">Foto</div>';

    container.innerHTML = photoHtml + "<p></p>";
    container.querySelector("p").textContent = names;
}

function escapeHtml(value) {
    return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


function renderGenreList(container, genres) {
    if (!container) {
        return;
    }

    container.innerHTML = "";

    (Array.isArray(genres) ? genres : []).forEach(
        function (genre) {
            var item = document.createElement("span");

            item.textContent = genre;
            container.appendChild(item);
        }
    );
}


/* =========================================================
   LAATST GEWIJZIGDE TITELS - VERSIE 0.17.2
========================================================= */

var STUDIO_RECENT_TITLES_KEY = "moviemind_studio_recent_titles_v1";
var STUDIO_RECENT_TITLES_LIMIT = 5;

function initialiseRecentTitleChanges() {
    renderRecentTitleChanges(loadRecentTitleChanges());
}

function getRecentTitleChangesList() {
    var headings = document.querySelectorAll(
        ".workspace-bottom-grid .compact-panel h3"
    );
    var list = null;

    headings.forEach(function (heading) {
        if (
            normaliseText(heading.textContent) ===
            normaliseText("Laatst gewijzigde films")
        ) {
            list = heading.parentElement
                ? heading.parentElement.querySelector("ul.compact-list")
                : null;
        }
    });

    return list;
}

function loadRecentTitleChanges() {
    try {
        var storedValue = window.localStorage.getItem(
            STUDIO_RECENT_TITLES_KEY
        );
        var parsedValue = storedValue
            ? JSON.parse(storedValue)
            : [];

        return Array.isArray(parsedValue)
            ? parsedValue.filter(function (entry) {
                return (
                    entry &&
                    typeof entry.title === "string" &&
                    entry.title.trim()
                );
            }).slice(0, STUDIO_RECENT_TITLES_LIMIT)
            : [];
    } catch (error) {
        console.warn(
            "Laatst gewijzigde titels konden niet worden geladen:",
            error
        );
        return [];
    }
}

function saveRecentTitleChanges(entries) {
    try {
        window.localStorage.setItem(
            STUDIO_RECENT_TITLES_KEY,
            JSON.stringify(entries)
        );
    } catch (error) {
        console.warn(
            "Laatst gewijzigde titels konden niet worden bewaard:",
            error
        );
    }
}

function addRecentTitleChange(record, action) {
    if (!record || !String(record.title || "").trim()) {
        return;
    }

    var entries = loadRecentTitleChanges();
    var recordType = getRecordType(record);
    var identity =
        recordType +
        "|" +
        String(record.id === null || record.id === undefined
            ? ""
            : record.id) +
        "|" +
        normaliseText(record.title);
    var newEntry = {
        identity: identity,
        title: String(record.title).trim(),
        type: recordType,
        action: action || "gewijzigd",
        timestamp: new Date().toISOString()
    };

    entries = entries.filter(function (entry) {
        return entry.identity !== identity;
    });

    entries.unshift(newEntry);
    entries = entries.slice(0, STUDIO_RECENT_TITLES_LIMIT);

    saveRecentTitleChanges(entries);
    renderRecentTitleChanges(entries);
}

function renderRecentTitleChanges(entries) {
    var list = getRecentTitleChangesList();

    if (!list) {
        return;
    }

    list.innerHTML = "";

    if (!entries.length) {
        var emptyItem = document.createElement("li");
        var emptyText = document.createElement("span");

        emptyItem.className = "recent-title-empty";
        emptyText.textContent = "Nog geen titels gewijzigd.";
        emptyItem.appendChild(emptyText);
        list.appendChild(emptyItem);
        return;
    }

    entries.forEach(function (entry) {
        var item = document.createElement("li");
        var titleElement = document.createElement("span");
        var timeElement = document.createElement("time");
        var date = new Date(entry.timestamp);
        var typeLabel = entry.type === "tv" ? "Serie" : "Film";

        titleElement.textContent =
            entry.title + " · " + typeLabel;

        if (Number.isNaN(date.getTime())) {
            timeElement.textContent = "";
        } else {
            timeElement.dateTime = entry.timestamp;
            timeElement.textContent =
                date.toLocaleDateString("nl-NL", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric"
                }) +
                " " +
                date.toLocaleTimeString("nl-NL", {
                    hour: "2-digit",
                    minute: "2-digit"
                });
        }

        item.appendChild(titleElement);
        item.appendChild(timeElement);
        list.appendChild(item);
    });
}


/* =========================================================
   HULPFUNCTIES
========================================================= */

function getRecordType(record) {
    var type = normaliseText(
        record.media_type ||
        record.type ||
        record.mediaType
    );

    if (
        type === "tv" ||
        type === "serie" ||
        type === "series" ||
        type === "television"
    ) {
        return "tv";
    }

    return "movie";
}


function joinValues(value) {
    if (Array.isArray(value)) {
        return value.join(" ");
    }

    return value || "";
}


function normaliseText(value) {
    return String(value || "")
        .toLocaleLowerCase("nl-NL")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
}


function updateLastLoaded(fileName) {
    var lastLoadedText = document.getElementById("last-loaded-text");
    var now;
    var time;

    if (!lastLoadedText) {
        return;
    }

    now = new Date();
    time = now.toLocaleTimeString("nl-NL", {
        hour: "2-digit",
        minute: "2-digit"
    });

    lastLoadedText.textContent =
        "Laatst geladen: " + fileName + " om " + time;
}


function updateDatabaseStatistics(records) {
    var rows = document.querySelectorAll(
        ".statistics-list .statistic-row"
    );
    var movies = 0;
    var series = 0;
    var actorNames = {};
    var directorNames = {};
    var genreNames = {};

    records.forEach(function (record) {
        if (getRecordType(record) === "tv") {
            series += 1;
        } else {
            movies += 1;
        }

        addNamesToSet(actorNames, record.actors);
        addNamesToSet(directorNames, record.director);
        addNamesToSet(genreNames, record.genre);
    });

    setStatisticValue(rows, 0, records.length);
    setStatisticValue(rows, 1, movies);
    setStatisticValue(rows, 2, series);
    setStatisticValue(rows, 3, Object.keys(actorNames).length);
    setStatisticValue(rows, 4, Object.keys(directorNames).length);
    setStatisticValue(rows, 5, Object.keys(genreNames).length);
}


function addNamesToSet(target, values) {
    (Array.isArray(values) ? values : []).forEach(
        function (value) {
            var key = normaliseText(value);

            if (key) {
                target[key] = true;
            }
        }
    );
}


function setStatisticValue(rows, index, value) {
    var valueElement;

    if (!rows[index]) {
        return;
    }

    valueElement = rows[index].querySelector("dd");

    if (valueElement) {
        valueElement.textContent =
            Number(value).toLocaleString("nl-NL");
    }
}


function addLogEntry(message) {
    var activityLog = document.getElementById("activity-log");
    var item;
    var messageElement;
    var timeElement;

    if (!activityLog) {
        return;
    }

    item = document.createElement("li");
    messageElement = document.createElement("span");
    timeElement = document.createElement("time");

    messageElement.textContent = message;
    timeElement.textContent = new Date().toLocaleTimeString(
        "nl-NL",
        {
            hour: "2-digit",
            minute: "2-digit"
        }
    );

    item.appendChild(messageElement);
    item.appendChild(timeElement);
    activityLog.insertBefore(item, activityLog.firstChild);

    while (activityLog.children.length > 5) {
        activityLog.removeChild(activityLog.lastElementChild);
    }
}


var notificationTimer = null;

function showNotification(message, type) {
    var notification = document.getElementById("studio-notification");

    if (!notification) {
        return;
    }

    window.clearTimeout(notificationTimer);

    notification.textContent = message;
    notification.className =
        "studio-notification is-" + type;
    notification.hidden = false;

    notificationTimer = window.setTimeout(function () {
        notification.hidden = true;
    }, 4500);
}


/* =========================================================
   ACTEURSFOTO'S - VERSIE 0.14
========================================================= */

function initialiseStudioPhotoManager() {
    var chooseFolderButton =
        document.getElementById("studio-choose-photo-folder");
    var saveButton =
        document.getElementById("studio-save-actor-photo");

    if (chooseFolderButton) {
        chooseFolderButton.addEventListener(
            "click",
            chooseStudioActorPhotoFolder
        );
    }

    if (saveButton) {
        saveButton.addEventListener(
            "click",
            saveStudioSelectedActorPhoto
        );
    }
}


async function loadStudioActorPhotos(actorSummary) {
    var requestId = studioPhotoState.requestId + 1;
    var actor;
    var profiles;

    studioPhotoState.requestId = requestId;
    studioPhotoState.selectedActor = null;
    studioPhotoState.selectedCandidate = null;

    clearStudioPhotoChoices();
    setStudioPhotoStatus(
        "TMDB zoekt beschikbare portretten voor " +
        actorSummary.name +
        "..."
    );
    setStudioPhotoPreview("", actorSummary.name);
    updateStudioPhotoSaveButton();

    try {
        actor = await findStudioTmdbActor(actorSummary.name);

        if (requestId !== studioPhotoState.requestId) {
            return;
        }

        if (!actor) {
            throw new Error(
                "Deze acteur kon niet betrouwbaar bij TMDB worden gevonden."
            );
        }

        studioPhotoState.selectedActor = actor;

        await showExistingStudioActorPhoto(actor.name);

        profiles = await fetchStudioActorProfiles(actor);

        if (requestId !== studioPhotoState.requestId) {
            return;
        }

        if (profiles.length === 0) {
            throw new Error(
                "TMDB heeft geen bruikbare portretfoto's voor deze acteur."
            );
        }

        renderStudioActorPhotoChoices(actor, profiles);
        setStudioPhotoStatus(
            "Kies een van de zes foto's. De eerste is automatisch aanbevolen."
        );
    } catch (error) {
        console.error("Acteursfoto's laden mislukt:", error);
        setStudioPhotoStatus(
            error.message || "De foto's konden niet worden geladen.",
            "error"
        );
    }
}


async function findStudioTmdbActor(actorName) {
    var url =
        "https://api.themoviedb.org/3/search/person" +
        "?api_key=" + encodeURIComponent(TMDB_API_KEY) +
        "&language=en-US" +
        "&include_adult=false" +
        "&query=" + encodeURIComponent(actorName);
    var response = await fetch(url);
    var data;
    var requestedName;
    var candidates;

    if (!response.ok) {
        throw new Error(
            "Acteur zoeken bij TMDB mislukt (HTTP " +
            response.status +
            ")."
        );
    }

    data = await response.json();
    requestedName = normaliseText(actorName);

    candidates = (data.results || [])
        .filter(function (person) {
            return (
                person &&
                person.id &&
                person.name &&
                (
                    person.known_for_department === "Acting" ||
                    !person.known_for_department
                )
            );
        })
        .sort(function (first, second) {
            var firstExact =
                normaliseText(first.name) === requestedName;
            var secondExact =
                normaliseText(second.name) === requestedName;

            if (firstExact !== secondExact) {
                return firstExact ? -1 : 1;
            }

            return (
                Number(second.popularity || 0) -
                Number(first.popularity || 0)
            );
        });

    if (candidates.length === 0) {
        return null;
    }

    return {
        id: candidates[0].id,
        name: candidates[0].name,
        requestedName: actorName,
        profile_path: candidates[0].profile_path || null
    };
}


async function fetchStudioActorProfiles(actor) {
    var url =
        "https://api.themoviedb.org/3/person/" +
        actor.id +
        "/images" +
        "?api_key=" + encodeURIComponent(TMDB_API_KEY);
    var response = await fetch(url);
    var data;
    var unique = {};

    if (!response.ok) {
        throw new Error(
            "Portretten ophalen mislukt (HTTP " +
            response.status +
            ")."
        );
    }

    data = await response.json();

    if (actor.profile_path) {
        unique[actor.profile_path] = {
            file_path: actor.profile_path,
            width: 0,
            height: 0,
            vote_average: 0,
            vote_count: 0,
            isDefault: true
        };
    }

    (data.profiles || []).forEach(function (profile) {
        if (profile && profile.file_path) {
            unique[profile.file_path] = profile;
        }
    });

    return Object.keys(unique)
        .map(function (key) {
            return unique[key];
        })
        .sort(function (first, second) {
            return (
                calculateStudioProfileScore(second) -
                calculateStudioProfileScore(first)
            );
        })
        .slice(0, 6);
}


function calculateStudioProfileScore(profile) {
    var width = Number(profile.width) || 0;
    var height = Number(profile.height) || 0;
    var ratio = height > 0 ? width / height : 0.8;
    var portraitFit =
        Math.max(0, 1 - Math.abs(ratio - 0.8));
    var resolution =
        Math.min(4, (width * height) / 1000000);
    var voteCount =
        Math.min(3, Number(profile.vote_count || 0) / 10);
    var voteAverage =
        Math.min(2, Number(profile.vote_average || 0) / 5);
    var defaultBonus = profile.isDefault ? 0.35 : 0;

    return (
        portraitFit * 5 +
        resolution +
        voteCount +
        voteAverage +
        defaultBonus
    );
}


function renderStudioActorPhotoChoices(actor, profiles) {
    var container =
        document.getElementById("studio-actor-photo-choices");

    if (!container) {
        return;
    }

    container.innerHTML = "";

    profiles.forEach(function (profile, index) {
        var button = document.createElement("button");
        var image = document.createElement("img");
        var candidate = {
            id: actor.id,
            name: actor.requestedName || actor.name,
            profile_path: profile.file_path
        };

        button.type = "button";
        button.className = "studio-photo-choice";
        button.setAttribute(
            "aria-label",
            "Kies foto " +
            (index + 1) +
            " van " +
            actor.name
        );

        image.loading = "lazy";
        image.alt =
            "Foto-optie " +
            (index + 1) +
            " van " +
            actor.name;
        image.src =
            "https://image.tmdb.org/t/p/w185" +
            profile.file_path;

        button.appendChild(image);

        if (index === 0) {
            var badge = document.createElement("span");

            badge.className = "studio-photo-choice-badge";
            badge.textContent = "Aanbevolen";
            button.appendChild(badge);
        }

        button.addEventListener("click", function () {
            var choices =
                container.querySelectorAll(".studio-photo-choice");

            choices.forEach(function (choice) {
                choice.classList.remove("is-selected");
            });

            button.classList.add("is-selected");
            studioPhotoState.selectedCandidate = candidate;

            setStudioPhotoPreview(
                "https://image.tmdb.org/t/p/w500" +
                profile.file_path,
                actor.name
            );

            setStudioPhotoStatus(
                "Foto " +
                (index + 1) +
                " geselecteerd. Kies de fotomap en sla hem daarna op."
            );

            updateStudioPhotoSaveButton();
        });

        container.appendChild(button);

        if (index === 0) {
            button.click();
        }
    });
}


async function chooseStudioActorPhotoFolder() {
    if (!("showDirectoryPicker" in window)) {
        setStudioPhotoStatus(
            "Gebruik Chrome of Edge om rechtstreeks in de acteursmap op te slaan.",
            "error"
        );
        return;
    }

    try {
        studioPhotoState.directoryHandle =
            await window.showDirectoryPicker({
                mode: "readwrite"
            });

        await saveStudioHandle(
            "actorsFolder",
            studioPhotoState.directoryHandle
        );

        if (
            !await requestStudioDirectoryPermission(
                studioPhotoState.directoryHandle
            )
        ) {
            throw new Error(
                "Geen schrijftoestemming voor de gekozen map."
            );
        }

        setStudioPhotoStatus(
            "Acteursfotomap actief: " +
            studioPhotoState.directoryHandle.name,
            "success"
        );

        if (studioPhotoState.selectedActor) {
            await showExistingStudioActorPhoto(
                studioPhotoState.selectedActor.requestedName ||
                studioPhotoState.selectedActor.name
            );
        }

        updateStudioPhotoSaveButton();
    } catch (error) {
        if (error && error.name === "AbortError") {
            return;
        }

        console.error("Fotomap kiezen mislukt:", error);
        setStudioPhotoStatus(
            error.message || "De fotomap kon niet worden geopend.",
            "error"
        );
    }
}


async function requestStudioDirectoryPermission(handle) {
    var options = { mode: "readwrite" };
    var currentPermission;

    if (!handle) {
        return false;
    }

    if (handle.queryPermission) {
        currentPermission =
            await handle.queryPermission(options);

        if (currentPermission === "granted") {
            return true;
        }
    }

    if (handle.requestPermission) {
        currentPermission =
            await handle.requestPermission(options);

        return currentPermission === "granted";
    }

    return true;
}


async function saveStudioSelectedActorPhoto() {
    var candidate = studioPhotoState.selectedCandidate;
    var directoryHandle = studioPhotoState.directoryHandle;
    var filename;
    var response;
    var blob;
    var fileHandle;
    var writable;

    if (!candidate) {
        setStudioPhotoStatus(
            "Kies eerst een foto.",
            "error"
        );
        return;
    }

    if (!directoryHandle) {
        setStudioPhotoStatus(
            "Kies eerst de map game/images/actors.",
            "error"
        );
        return;
    }

    try {
        if (
            !await requestStudioDirectoryPermission(directoryHandle)
        ) {
            throw new Error(
                "Geen schrijftoestemming voor de acteursmap."
            );
        }

        filename =
            createStudioActorPhotoFilename(candidate.name);

        response = await fetch(
            "https://image.tmdb.org/t/p/w500" +
            candidate.profile_path,
            {
                mode: "cors",
                cache: "no-store"
            }
        );

        if (!response.ok) {
            throw new Error(
                "De foto kon niet worden gedownload (HTTP " +
                response.status +
                ")."
            );
        }

        blob = await response.blob();

        if (!blob || blob.size === 0) {
            throw new Error(
                "TMDB stuurde een leeg afbeeldingsbestand."
            );
        }

        fileHandle =
            await directoryHandle.getFileHandle(
                filename,
                { create: true }
            );
        writable = await fileHandle.createWritable();

        await writable.write(blob);
        await writable.close();

        setStudioPhotoStatus(
            "Foto opgeslagen als " + filename + ".",
            "success"
        );

        await showExistingStudioActorPhoto(candidate.name);
    } catch (error) {
        console.error("Acteursfoto opslaan mislukt:", error);
        setStudioPhotoStatus(
            error.message || "De foto kon niet worden opgeslagen.",
            "error"
        );
    }
}


async function showExistingStudioActorPhoto(actorName) {
    var file;

    if (!studioPhotoState.directoryHandle) {
        return;
    }

    try {
        file = await findStudioActorPhotoFile(actorName);

        if (!file) {
            return;
        }

        if (studioPhotoState.previewObjectUrl) {
            URL.revokeObjectURL(
                studioPhotoState.previewObjectUrl
            );
        }

        studioPhotoState.previewObjectUrl =
            URL.createObjectURL(file);

        setStudioPhotoPreview(
            studioPhotoState.previewObjectUrl,
            actorName
        );

        setStudioPhotoStatus(
            "Bestaande lokale foto gevonden. Een nieuwe keuze vervangt deze.",
            "success"
        );
    } catch (error) {
        console.warn(
            "Lokale acteursfoto bekijken mislukt:",
            error
        );
    }
}


async function findStudioActorPhotoFile(actorName) {
    var expectedFilename = createStudioActorPhotoFilename(actorName);
    var fileHandle;

    try {
        fileHandle = await studioPhotoState.directoryHandle.getFileHandle(
            expectedFilename,
            { create: false }
        );
        return await fileHandle.getFile();
    } catch (error) {
        if (error && error.name === "NotFoundError") {
            return null;
        }
        throw error;
    }
}

function createStudioActorPhotoFilename(name) {
    var safeName = String(name || "")
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/&/g, " and ")
        .replace(/['\u2019]/g, "")
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");

    return (safeName || "acteur") + ".jpg";
}


function createStudioActorPhotoIdentity(value) {
    return String(value || "")
        .trim()
        .toLowerCase()
        .replace(/\.(jpe?g|png|webp)$/i, "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/&/g, " and ")
        .replace(/['\u2019]/g, "")
        .replace(/[^a-z0-9]+/g, "");
}


function clearStudioPhotoChoices() {
    var container =
        document.getElementById("studio-actor-photo-choices");

    if (container) {
        container.innerHTML = "";
    }
}


function setStudioPhotoPreview(source, actorName) {
    var image =
        document.getElementById("studio-actor-photo-preview");
    var placeholder =
        document.getElementById("studio-actor-photo-placeholder");

    if (!image || !placeholder) {
        return;
    }

    if (source) {
        image.src = source;
        image.alt = "Foto van " + actorName;
        image.hidden = false;
        placeholder.hidden = true;
    } else {
        image.removeAttribute("src");
        image.alt = "";
        image.hidden = true;
        placeholder.hidden = false;
    }
}


function setStudioPhotoStatus(message, state) {
    var status =
        document.getElementById("studio-actor-photo-status");

    if (!status) {
        return;
    }

    status.textContent = message;
    status.className =
        "studio-photo-status" +
        (state ? " is-" + state : "");
}


function updateStudioPhotoSaveButton() {
    var saveButton =
        document.getElementById("studio-save-actor-photo");

    if (!saveButton) {
        return;
    }

    saveButton.disabled = !(
        studioPhotoState.selectedCandidate &&
        studioPhotoState.directoryHandle
    );
}

/* =========================================================
   TV-SERIE IMPORTER - VERSIE 0.15.1
========================================================= */

/* =========================================================
   FILMIMPORTER + TMDB-VERRIJKING - VERSIE 0.17.1
========================================================= */

var movieImporterState = { searchRequestId: 0 };

function initialiseMovieImporter() {
    var openButton = document.getElementById("import-movie-button");
    var closeButton = document.getElementById("movie-import-close");
    var modal = document.getElementById("movie-import-modal");
    var form = document.getElementById("movie-import-search-form");
    var backdrop = modal ? modal.querySelector("[data-close-movie-importer]") : null;

    if (!openButton || !closeButton || !modal || !form) {
        console.error("Filmimporter kan niet starten: vereiste HTML-onderdelen ontbreken.");
        return;
    }

    /* Voorkomt dubbele koppelingen wanneer het script opnieuw geladen wordt. */
    if (openButton.dataset.movieImporterReady !== "true") {
        openButton.addEventListener("click", function (event) {
            event.preventDefault();
            event.stopPropagation();
            openMovieImporter();
        });
        openButton.dataset.movieImporterReady = "true";
    }

    if (closeButton.dataset.movieImporterReady !== "true") {
        closeButton.addEventListener("click", closeMovieImporter);
        closeButton.dataset.movieImporterReady = "true";
    }

    if (backdrop && backdrop.dataset.movieImporterReady !== "true") {
        backdrop.addEventListener("click", closeMovieImporter);
        backdrop.dataset.movieImporterReady = "true";
    }

    if (form.dataset.movieImporterReady !== "true") {
        form.addEventListener("submit", function (event) {
            event.preventDefault();
            searchMoviesAtTmdb();
        });
        form.dataset.movieImporterReady = "true";
    }
}

function openMovieImporter() {
    var modal = document.getElementById("movie-import-modal");
    var input = document.getElementById("movie-import-search-input");

    if (!modal) {
        showNotification("Filmimporter kon niet worden geopend: venster ontbreekt.", "error");
        console.error("Element #movie-import-modal ontbreekt.");
        return;
    }

    /* Het venster opent altijd. Zo lijkt de knop nooit meer 'dood'. */
    modal.hidden = false;
    modal.removeAttribute("hidden");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";

    if (movieMindState.records.length === 0) {
        setMovieImportStatus(
            "Je kunt al zoeken. Laad vóór Toevoegen eerst moviemind_database.json.",
            "error"
        );
    } else {
        setMovieImportStatus("Zoek een film en kies daarna Toevoegen.", "");
    }

    window.setTimeout(function () {
        if (input) {
            input.focus();
            input.select();
        }
    }, 30);
}

/* Ook beschikbaar voor handmatige of inline aanroepen. */
window.openMovieImporter = openMovieImporter;

function closeMovieImporter() {
    var modal = document.getElementById("movie-import-modal");
    if (modal) { modal.hidden = true; }
    document.body.style.overflow = "";
}

async function searchMoviesAtTmdb() {
    var input = document.getElementById("movie-import-search-input");
    var results = document.getElementById("movie-import-results");
    var query = input ? input.value.trim() : "";
    var requestId;
    if (!query) { setMovieImportStatus("Vul eerst de naam van een film in.", "error"); return; }
    requestId = ++movieImporterState.searchRequestId;
    results.innerHTML = "";
    setMovieImporterBusy(true);
    setMovieImportStatus("TMDB wordt doorzocht...", "");
    try {
        var response = await fetch("https://api.themoviedb.org/3/search/movie?api_key=" + encodeURIComponent(TMDB_API_KEY) + "&language=nl-NL&include_adult=false&query=" + encodeURIComponent(query));
        if (!response.ok) { throw new Error("TMDB gaf foutcode " + response.status + "."); }
        var payload = await response.json();
        if (requestId !== movieImporterState.searchRequestId) { return; }
        renderMovieImportResults((payload.results || []).slice(0, 12));
    } catch (error) {
        setMovieImportStatus("Zoeken bij TMDB is mislukt: " + (error.message || "onbekende fout"), "error");
    } finally { setMovieImporterBusy(false); }
}

function renderMovieImportResults(movies) {
    var container = document.getElementById("movie-import-results");
    container.innerHTML = "";
    if (!movies.length) { setMovieImportStatus("Geen films gevonden.", "error"); return; }
    setMovieImportStatus(movies.length + " resultaten gevonden.", "");
    movies.forEach(function (item) { container.appendChild(createMovieImportResult(item)); });
}

function createMovieImportResult(item) {
    var article = document.createElement("article");
    var poster = item.poster_path ? document.createElement("img") : document.createElement("div");
    var text = document.createElement("div");
    var title = document.createElement("h3");
    var metadata = document.createElement("p");
    var overview = document.createElement("p");
    var button = document.createElement("button");
    article.className = "tv-import-result";
    if (item.poster_path) { poster.src = "https://image.tmdb.org/t/p/w154" + item.poster_path; poster.alt = "Poster van " + item.title; }
    else { poster.className = "tv-import-poster-placeholder"; poster.textContent = "🎬"; }
    title.textContent = item.title || "Film zonder titel";
    metadata.textContent = (item.release_date ? item.release_date.slice(0,4) : "jaar onbekend") + " · TMDB " + item.id;
    overview.textContent = item.overview ? shortenTvOverview(item.overview,170) : "Geen omschrijving beschikbaar.";
    button.type = "button";
    if (isMovieAlreadyImported(item.id)) { button.textContent = "Al aanwezig"; button.disabled = true; }
    else { button.textContent = "＋ Toevoegen"; button.addEventListener("click", function () { importMovie(item.id, button); }); }
    text.appendChild(title); text.appendChild(metadata); text.appendChild(overview);
    article.appendChild(poster); article.appendChild(text); article.appendChild(button);
    return article;
}

function isMovieAlreadyImported(tmdbId) {
    return movieMindState.records.some(function (record) { return getRecordType(record) === "movie" && Number(record.id) === Number(tmdbId); });
}

async function importMovie(tmdbId, button) {
    var originalText = button.textContent;
    var record;
    button.disabled = true; button.textContent = "Ophalen...";
    setMovieImportStatus("Filmgegevens en acteurs worden opgehaald...", "");
    try {
        var details = await fetchTmdbTitleDetails("movie", tmdbId);
        record = createMovieDatabaseRecord(details);
        if (isMovieAlreadyImported(record.id)) { button.textContent = "Al aanwezig"; return; }
        movieMindState.records.push(record); synchroniseLoadedDatabaseRecords(); await saveUpdatedStudioDatabase();
        updateDatabaseStatistics(movieMindState.records);
        addRecentTitleChange(record, "toegevoegd");
        addLogEntry("Film toegevoegd: " + record.title);
        button.textContent = "✓ Toegevoegd"; setMovieImportStatus(record.title + " is toegevoegd en opgeslagen.", "success");
        showNotification("Film toegevoegd: " + record.title, "success");
        if (movieMindState.view === "films") { applyCurrentView(); }
    } catch (error) {
        if (record) { movieMindState.records = movieMindState.records.filter(function (r) { return r !== record; }); synchroniseLoadedDatabaseRecords(); }
        button.disabled = false; button.textContent = originalText;
        setMovieImportStatus("Toevoegen is mislukt: " + (error.message || "onbekende fout"), "error");
    }
}

function createMovieDatabaseRecord(details) {
    var credits = details.credits || {};
    var cast = Array.isArray(credits.cast) ? credits.cast.slice(0, 8) : [];
    var crew = Array.isArray(credits.crew) ? credits.crew : [];
    var directors = crew.filter(function (p) { return p.job === "Director"; });
    return {
        id: details.id, title: details.title || details.original_title || "Film zonder titel",
        year: details.release_date ? Number(details.release_date.slice(0,4)) : null,
        genre: (details.genres || []).map(function (g) { return g.name; }),
        director: directors.map(function (p) { return p.name; }),
        actors: cast.map(function (p) { return p.name; }).filter(Boolean),
        characters: cast.map(function (p) { return p.character || ""; }).filter(Boolean),
        poster_path: details.poster_path || null, backdrop_path: details.backdrop_path || null,
        overview: details.overview || "", rating: Number(details.vote_average || 0), runtime: details.runtime || null,
        cast_details: cast.map(function (p) { return { id:p.id, name:p.name, character:p.character || "", profile_path:p.profile_path || null }; }),
        director_details: directors.map(function (p) { return { id:p.id, name:p.name, profile_path:p.profile_path || null }; }),
        fullDetails: true, media_type: "movie"
    };
}

async function fetchTmdbTitleDetails(type, id) {
    var response = await fetch("https://api.themoviedb.org/3/" + type + "/" + encodeURIComponent(id) + "?api_key=" + encodeURIComponent(TMDB_API_KEY) + "&language=nl-NL&append_to_response=credits");
    if (!response.ok) { throw new Error("TMDB gaf foutcode " + response.status + "."); }
    return await response.json();
}

async function enrichTitleRecordFromTmdb(record) {
    if (!record || !record.id) { return; }
    var type = getRecordType(record);
    var details = await fetchTmdbTitleDetails(type, record.id);
    var enriched = type === "tv" ? createTvDatabaseRecord(details) : createMovieDatabaseRecord(details);
    Object.keys(enriched).forEach(function (key) { record[key] = enriched[key]; });
    synchroniseLoadedDatabaseRecords();
    await saveUpdatedStudioDatabase();
    addRecentTitleChange(record, "aangevuld");
    addLogEntry("Afbeeldingen aangevuld: " + record.title);
}

function setMovieImportStatus(message, type) {
    var status = document.getElementById("movie-import-status");
    if (!status) { return; }
    status.textContent = message; status.classList.remove("is-error","is-success");
    if (type === "error") { status.classList.add("is-error"); }
    if (type === "success") { status.classList.add("is-success"); }
}

function setMovieImporterBusy(isBusy) {
    var button = document.getElementById("movie-import-search-button");
    var input = document.getElementById("movie-import-search-input");
    if (button) { button.disabled = isBusy; button.textContent = isBusy ? "Zoeken..." : "🔍 Zoeken"; }
    if (input) { input.disabled = isBusy; }
}

/* =========================================================
   ONTBREKENDE ACTEURSFOTO'S AANVULLEN
========================================================= */

function initialiseMissingPhotosFiller() {
    var button = document.getElementById("fill-missing-photos-button");
    if (button) { button.addEventListener("click", fillMissingActorPhotos); }
}

async function fillMissingActorPhotos() {
    var button = document.getElementById("fill-missing-photos-button");
    if (!studioPhotoState.directoryHandle) {
        showNotification("Kies eerst bij Acteursfoto beheren de map game/images/actors.", "error");
        return;
    }
    if (!window.confirm("Alle ontbrekende acteursfoto's aanvullen? Dit kan bij duizenden acteurs geruime tijd duren.")) { return; }
    var names = buildActorItems().map(function (a) { return a.name; });
    var saved = 0, skipped = 0, failed = 0;
    button.disabled = true;
    try {
        for (var i=0; i<names.length; i+=1) {
            button.textContent = "Foto's aanvullen " + (i+1) + "/" + names.length;
            var existing = await findStudioActorPhotoFile(names[i]);
            if (existing) { skipped += 1; continue; }
            try {
                var actor = await findStudioTmdbActor(names[i]);
                if (!actor || !actor.profile_path) { failed += 1; continue; }
                await saveActorPhotoDirectly(names[i], actor.profile_path);
                saved += 1;
            } catch (error) { failed += 1; console.warn("Foto overslaan:", names[i], error); }
            await new Promise(function (resolve) { window.setTimeout(resolve, 120); });
        }
        addLogEntry("Foto-aanvulling klaar: " + saved + " opgeslagen");
        showNotification("Klaar: " + saved + " foto's opgeslagen, " + skipped + " al aanwezig, " + failed + " niet gevonden.", "success");
    } finally {
        button.disabled = false; button.textContent = "🖼 Ontbrekende foto's aanvullen";
    }
}

async function saveActorPhotoDirectly(actorName, profilePath) {
    var response = await fetch("https://image.tmdb.org/t/p/w500" + profilePath, { mode:"cors", cache:"no-store" });
    if (!response.ok) { throw new Error("HTTP " + response.status); }
    var blob = await response.blob();
    var fileHandle = await studioPhotoState.directoryHandle.getFileHandle(createStudioActorPhotoFilename(actorName), { create:true });
    var writable = await fileHandle.createWritable();
    await writable.write(blob); await writable.close();
}

var tvImporterState = {
    searchRequestId: 0,
    isBusy: false
};

function initialiseTvSeriesImporter() {
    var openButton = document.getElementById("import-tv-series-button");
    var closeButton = document.getElementById("tv-import-close");
    var modal = document.getElementById("tv-import-modal");
    var form = document.getElementById("tv-import-search-form");
    var backdrop = modal
        ? modal.querySelector("[data-close-tv-importer]")
        : null;

    if (!openButton || !closeButton || !modal || !form) {
        console.warn("De TV-serie importer ontbreekt gedeeltelijk in index.html.");
        return;
    }

    openButton.addEventListener("click", function () {
        openTvSeriesImporter();
    });

    closeButton.addEventListener("click", closeTvSeriesImporter);

    if (backdrop) {
        backdrop.addEventListener("click", closeTvSeriesImporter);
    }

    form.addEventListener("submit", function (event) {
        event.preventDefault();
        searchTvSeriesAtTmdb();
    });

    document.addEventListener("keydown", function (event) {
        if (event.key === "Escape" && !modal.hidden) {
            closeTvSeriesImporter();
        }
    });
}

function openTvSeriesImporter() {
    var modal = document.getElementById("tv-import-modal");
    var input = document.getElementById("tv-import-search-input");

    if (!modal) {
        return;
    }

    if (movieMindState.records.length === 0) {
        showNotification(
            "Laad eerst de MovieMind-database voordat je een serie toevoegt.",
            "error"
        );
        return;
    }

    modal.hidden = false;
    document.body.style.overflow = "hidden";
    setTvImportStatus(
        "Zoek een serie en kies daarna Toevoegen.",
        ""
    );

    window.setTimeout(function () {
        if (input) {
            input.focus();
            input.select();
        }
    }, 30);
}

function closeTvSeriesImporter() {
    var modal = document.getElementById("tv-import-modal");

    if (modal) {
        modal.hidden = true;
    }

    document.body.style.overflow = "";
}

async function searchTvSeriesAtTmdb() {
    var input = document.getElementById("tv-import-search-input");
    var results = document.getElementById("tv-import-results");
    var query = input ? input.value.trim() : "";
    var requestId;
    var response;
    var payload;

    if (!query) {
        setTvImportStatus("Vul eerst de naam van een TV-serie in.", "error");
        return;
    }

    if (typeof TMDB_API_KEY === "undefined" || !TMDB_API_KEY) {
        setTvImportStatus("De TMDB API-key ontbreekt in config.js.", "error");
        return;
    }

    requestId = tvImporterState.searchRequestId + 1;
    tvImporterState.searchRequestId = requestId;
    tvImporterState.isBusy = true;

    if (results) {
        results.innerHTML = "";
    }

    setTvImportStatus("TMDB wordt doorzocht...", "");
    setTvImporterSearchBusy(true);

    try {
        response = await fetch(
            "https://api.themoviedb.org/3/search/tv" +
            "?api_key=" + encodeURIComponent(TMDB_API_KEY) +
            "&language=nl-NL" +
            "&include_adult=false" +
            "&query=" + encodeURIComponent(query)
        );

        if (!response.ok) {
            throw new Error("TMDB gaf foutcode " + response.status + ".");
        }

        payload = await response.json();

        if (requestId !== tvImporterState.searchRequestId) {
            return;
        }

        renderTvImportResults(
            Array.isArray(payload.results)
                ? payload.results.slice(0, 12)
                : []
        );
    } catch (error) {
        console.error("TV-serie zoeken mislukt:", error);
        setTvImportStatus(
            "Zoeken bij TMDB is mislukt: " +
                (error.message || "onbekende fout"),
            "error"
        );
    } finally {
        tvImporterState.isBusy = false;
        setTvImporterSearchBusy(false);
    }
}

function renderTvImportResults(series) {
    var container = document.getElementById("tv-import-results");

    if (!container) {
        return;
    }

    container.innerHTML = "";

    if (series.length === 0) {
        setTvImportStatus("Geen TV-series gevonden.", "error");
        return;
    }

    setTvImportStatus(
        series.length +
            " resultaat" +
            (series.length === 1 ? "" : "en") +
            " gevonden.",
        ""
    );

    series.forEach(function (item) {
        container.appendChild(createTvImportResult(item));
    });
}

function createTvImportResult(item) {
    var article = document.createElement("article");
    var poster;
    var text = document.createElement("div");
    var title = document.createElement("h3");
    var metadata = document.createElement("p");
    var overview = document.createElement("p");
    var button = document.createElement("button");
    var year = item.first_air_date
        ? item.first_air_date.slice(0, 4)
        : "jaar onbekend";

    article.className = "tv-import-result";

    if (item.poster_path) {
        poster = document.createElement("img");
        poster.src = "https://image.tmdb.org/t/p/w154" + item.poster_path;
        poster.alt = "Poster van " + (item.name || "TV-serie");
    } else {
        poster = document.createElement("div");
        poster.className = "tv-import-poster-placeholder";
        poster.textContent = "📺";
    }

    title.textContent = item.name || "Serie zonder titel";
    metadata.textContent = year + " · TMDB " + item.id;
    overview.textContent = item.overview
        ? shortenTvOverview(item.overview, 170)
        : "Geen omschrijving beschikbaar.";
    overview.style.marginTop = "7px";

    button.type = "button";

    if (isTvSeriesAlreadyImported(item.id)) {
        button.textContent = "Al aanwezig";
        button.disabled = true;
    } else {
        button.textContent = "＋ Toevoegen";
        button.addEventListener("click", function () {
            importTvSeries(item.id, button);
        });
    }

    text.appendChild(title);
    text.appendChild(metadata);
    text.appendChild(overview);
    article.appendChild(poster);
    article.appendChild(text);
    article.appendChild(button);

    return article;
}

function shortenTvOverview(value, maximumLength) {
    var text = String(value || "").trim();

    if (text.length <= maximumLength) {
        return text;
    }

    return text.slice(0, maximumLength - 1).trim() + "…";
}

function isTvSeriesAlreadyImported(tmdbId) {
    return movieMindState.records.some(function (record) {
        return (
            getRecordType(record) === "tv" &&
            Number(record.id) === Number(tmdbId)
        );
    });
}

async function importTvSeries(tmdbId, button) {
    var originalText = button.textContent;
    var response;
    var details;
    var record;

    button.disabled = true;
    button.textContent = "Ophalen...";
    setTvImportStatus("Seriegegevens en acteurs worden opgehaald...", "");

    try {
        response = await fetch(
            "https://api.themoviedb.org/3/tv/" +
            encodeURIComponent(tmdbId) +
            "?api_key=" + encodeURIComponent(TMDB_API_KEY) +
            "&language=nl-NL" +
            "&append_to_response=credits"
        );

        if (!response.ok) {
            throw new Error("TMDB gaf foutcode " + response.status + ".");
        }

        details = await response.json();
        record = createTvDatabaseRecord(details);

        if (isTvSeriesAlreadyImported(record.id)) {
            button.textContent = "Al aanwezig";
            setTvImportStatus("Deze serie staat al in de database.", "error");
            return;
        }

        movieMindState.records.push(record);
        synchroniseLoadedDatabaseRecords();
        await saveUpdatedStudioDatabase();

        updateDatabaseStatistics(movieMindState.records);
        movieMindState.currentPage = 1;
        addRecentTitleChange(record, "toegevoegd");
        addLogEntry("TV-serie toegevoegd: " + record.title);

        button.textContent = "✓ Toegevoegd";
        setTvImportStatus(
            record.title + " is toegevoegd en opgeslagen.",
            "success"
        );
        showNotification(
            "TV-serie toegevoegd: " + record.title,
            "success"
        );

        if (movieMindState.view === "series") {
            applyCurrentView();
        }
    } catch (error) {
        console.error("TV-serie importeren mislukt:", error);

        if (record) {
            movieMindState.records = movieMindState.records.filter(
                function (existingRecord) {
                    return existingRecord !== record;
                }
            );
            synchroniseLoadedDatabaseRecords();
        }

        button.disabled = false;
        button.textContent = originalText;
        setTvImportStatus(
            "Toevoegen is mislukt: " +
                (error.message || "onbekende fout"),
            "error"
        );
    }
}

function createTvDatabaseRecord(details) {
    var credits = details.credits || {};
    var cast = Array.isArray(credits.cast)
        ? credits.cast.slice(0, 8)
        : [];
    var directors = [];

    if (Array.isArray(details.created_by)) {
        directors = details.created_by
            .map(function (person) { return person.name; })
            .filter(Boolean);
    }

    if (directors.length === 0 && Array.isArray(credits.crew)) {
        directors = credits.crew
            .filter(function (person) {
                return person.job === "Director" || person.job === "Executive Producer";
            })
            .slice(0, 3)
            .map(function (person) { return person.name; })
            .filter(Boolean);
    }

    return {
        id: details.id,
        title: details.name || details.original_name || "Serie zonder titel",
        year: details.first_air_date
            ? Number(details.first_air_date.slice(0, 4))
            : null,
        genre: (details.genres || []).map(function (genre) {
            return genre.name;
        }),
        director: directors,
        actors: cast.map(function (person) {
            return person.name;
        }).filter(Boolean),
        characters: cast.map(function (person) {
            return person.character || person.roles && person.roles[0] && person.roles[0].character || "";
        }).filter(Boolean),
        poster_path: details.poster_path || null,
        backdrop_path: details.backdrop_path || null,
        overview: details.overview || "",
        rating: Number(details.vote_average || 0),
        runtime: Array.isArray(details.episode_run_time) && details.episode_run_time[0] ? details.episode_run_time[0] : null,
        cast_details: cast.map(function (person) {
            return { id: person.id, name: person.name, character: person.character || "", profile_path: person.profile_path || null };
        }),
        director_details: directors.map(function (name) { return { name: name, profile_path: null }; }),
        fullDetails: true,
        media_type: "tv"
    };
}

function synchroniseLoadedDatabaseRecords() {
    var database = window.movieMindDatabase;

    if (Array.isArray(database)) {
        window.movieMindDatabase = movieMindState.records;
        return;
    }

    if (database && Array.isArray(database.films)) {
        database.films = movieMindState.records;
        return;
    }

    if (database && Array.isArray(database.titles)) {
        database.titles = movieMindState.records;
        return;
    }

    window.movieMindDatabase = { films: movieMindState.records };
}

async function saveUpdatedStudioDatabase() {
    var databaseText;
    var writable;

    synchroniseLoadedDatabaseRecords();
    databaseText = JSON.stringify(window.movieMindDatabase, null, 2);

    if (movieMindState.databaseFileHandle) {
        if (!await ensureStudioFilePermission(movieMindState.databaseFileHandle)) {
            throw new Error(
                "Geen schrijftoestemming voor de database. Klik opnieuw op Database laden."
            );
        }

        writable = await movieMindState.databaseFileHandle.createWritable();
        await writable.write(databaseText);
        await writable.close();
        return;
    }

    downloadUpdatedStudioDatabase(databaseText);
    showNotification(
        "De bijgewerkte database is gedownload. Vervang hiermee je oude JSON-bestand.",
        "success"
    );
}

async function ensureStudioFilePermission(handle) {
    var permission;

    if (!handle) {
        return false;
    }

    if (!handle.queryPermission) {
        return true;
    }

    permission = await handle.queryPermission({ mode: "readwrite" });

    if (permission === "granted") {
        return true;
    }

    if (handle.requestPermission) {
        permission = await handle.requestPermission({ mode: "readwrite" });
    }

    return permission === "granted";
}

function downloadUpdatedStudioDatabase(databaseText) {
    var blob = new Blob([databaseText], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");
    var fileName = window.movieMindDatabaseFileName || "moviemind-database.json";

    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();

    window.setTimeout(function () {
        URL.revokeObjectURL(url);
    }, 1000);
}

function setTvImportStatus(message, type) {
    var status = document.getElementById("tv-import-status");

    if (!status) {
        return;
    }

    status.textContent = message;
    status.classList.remove("is-error", "is-success");

    if (type === "error") {
        status.classList.add("is-error");
    } else if (type === "success") {
        status.classList.add("is-success");
    }
}

function setTvImporterSearchBusy(isBusy) {
    var button = document.getElementById("tv-import-search-button");
    var input = document.getElementById("tv-import-search-input");

    if (button) {
        button.disabled = isBusy;
        button.textContent = isBusy ? "Zoeken..." : "🔍 Zoeken";
    }

    if (input) {
        input.disabled = isBusy;
    }
}