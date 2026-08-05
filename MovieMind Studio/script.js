/* =========================================================
   MOVIEMIND STUDIO 2.0
   Schone basis
========================================================= */

"use strict";

const MOVIEMIND_API_KEY =
    typeof TMDB_API_KEY !== "undefined" ? TMDB_API_KEY : "";

const state = {
    type: "movie",
    database: null,
    records: [],
    databaseHandle: null,
    actorsFolderHandle: null,
    selectedResult: null,
    selectedDetails: null,
    selectedPersonProfilePath: null,
    searchTimer: null,
    searchRequestId: 0,
    searchQuery: "",
    searchPage: 1,
    searchTotalPages: 1
};

const DB_NAME = "MovieMindStudio2";
const DB_VERSION = 1;
const HANDLE_STORE = "handles";
const DATABASE_HANDLE_KEY = "mainDatabase";
const ACTORS_FOLDER_HANDLE_KEY = "actorsFolder";
const SELECTED_TYPE_KEY = "moviemindStudioSelectedType";

document.addEventListener("DOMContentLoaded", () => {
    restoreSelectedType();
    initialiseTypeButtons();
    applySelectedTypeToUi();
    initialiseSearch();
    initialiseSearchPagination();
    initialiseMaintenance();
    initialiseDatabaseButtons();
    initialiseActorsFolderButtons();
    initialiseAddButton();
    restoreDatabaseConnection();
    restoreActorsFolderConnection();
});


/* =========================================================
   STAP 1 - TYPE KIEZEN
========================================================= */

function initialiseTypeButtons() {
    document.querySelectorAll(".type-button").forEach((button) => {
        button.addEventListener("click", () => {
            document.querySelectorAll(".type-button").forEach((item) => {
                item.classList.remove("is-active");
            });

            button.classList.add("is-active");
            state.type = button.dataset.type || "movie";
            localStorage.setItem(SELECTED_TYPE_KEY, state.type);
            state.selectedResult = null;
            state.selectedDetails = null;
            state.selectedPersonProfilePath = null;

            updateSearchCopy();
            resetSearchResults();
            resetSearchPagination();
            resetPreview();

            const input = document.getElementById("search-input");
            input.value = "";
            input.focus();
        });
    });
}

function restoreSelectedType() {
    const savedType = localStorage.getItem(SELECTED_TYPE_KEY);

    if (["movie", "tv", "person"].includes(savedType)) {
        state.type = savedType;
    }
}

function applySelectedTypeToUi() {
    document.querySelectorAll(".type-button").forEach((button) => {
        button.classList.toggle(
            "is-active",
            button.dataset.type === state.type
        );
    });

    updateSearchCopy();
}


function updateSearchCopy() {
    const heading = document.getElementById("search-heading");
    const peopleHeading = document.getElementById("people-heading");
    const input = document.getElementById("search-input");

    if (state.type === "tv") {
        heading.textContent = "Serie zoeken";
        peopleHeading.textContent = "Acteurs";
        input.placeholder = "Typ minimaal 3 letters van een serie...";
    } else if (state.type === "person") {
        heading.textContent = "Acteur zoeken";
        peopleHeading.textContent = "Foto's";
        input.placeholder = "Typ minimaal 3 letters van een acteur...";
    } else {
        heading.textContent = "Film zoeken";
        peopleHeading.textContent = "Acteurs";
        input.placeholder = "Typ minimaal 3 letters van een film...";
    }
}


/* =========================================================
   STAP 2 - AUTOMATISCH ZOEKEN NA 3 LETTERS
========================================================= */

function initialiseSearch() {
    const input = document.getElementById("search-input");
    const button = document.getElementById("search-button");

    input.addEventListener("input", () => {
        window.clearTimeout(state.searchTimer);

        const query = input.value.trim();

        if (query.length < 3) {
            setSearchStatus(
                query.length === 0
                    ? "Begin met typen om te zoeken."
                    : "Typ nog " + (3 - query.length) + " letter(s)."
            );
            resetSearchResults();
            resetSearchPagination();
            return;
        }

        state.searchTimer = window.setTimeout(() => {
            searchTmdb(query, 1);
        }, 450);
    });

    input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
            event.preventDefault();
            const query = input.value.trim();

            if (query.length >= 3) {
                window.clearTimeout(state.searchTimer);
                searchTmdb(query, 1);
            }
        }
    });

    button.addEventListener("click", () => {
        const query = input.value.trim();

        if (query.length < 3) {
            setSearchStatus("Typ minimaal drie letters.", "error");
            return;
        }

        window.clearTimeout(state.searchTimer);
        searchTmdb(query, 1);
    });
}

async function searchTmdb(query, page = 1) {
    if (!MOVIEMIND_API_KEY) {
        setSearchStatus(
            "TMDB_API_KEY ontbreekt. Controleer of config.js vóór script.js wordt geladen.",
            "error"
        );
        return;
    }

    const requestId = ++state.searchRequestId;
    const endpoint = state.type === "person"
        ? "person"
        : state.type;

    state.searchQuery = query;
    state.searchPage = page;

    setSearchStatus("TMDB wordt doorzocht...");
    renderLoadingState();

    try {
        const url =
            "https://api.themoviedb.org/3/search/" + endpoint +
            "?api_key=" + encodeURIComponent(MOVIEMIND_API_KEY) +
            "&language=nl-NL&include_adult=false&page=" +
            encodeURIComponent(page) +
            "&query=" + encodeURIComponent(query);

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error("TMDB gaf foutcode " + response.status + ".");
        }

        const payload = await response.json();

        if (requestId !== state.searchRequestId) {
            return;
        }

        const results = (payload.results || []).slice(0, 12);
        state.searchPage = Number(payload.page || page);
        state.searchTotalPages = Math.max(
            1,
            Math.min(Number(payload.total_pages || 1), 20)
        );

        renderSearchResults(results);
        updateSearchPagination();

        setSearchStatus(
            results.length
                ? results.length + " resultaten op deze pagina."
                : "Geen resultaten gevonden.",
            results.length ? "success" : ""
        );
    } catch (error) {
        console.error(error);
        setSearchStatus(
            "Zoeken is mislukt: " + (error.message || "onbekende fout"),
            "error"
        );
        resetSearchResults("Zoeken is mislukt.");
        resetSearchPagination();
    }
}

function initialiseSearchPagination() {
    const previousButton = document.getElementById("search-prev-page");
    const nextButton = document.getElementById("search-next-page");

    if (!previousButton || !nextButton) {
        return;
    }

    previousButton.addEventListener("click", () => {
        if (state.searchPage > 1 && state.searchQuery) {
            searchTmdb(state.searchQuery, state.searchPage - 1);
        }
    });

    nextButton.addEventListener("click", () => {
        if (
            state.searchPage < state.searchTotalPages &&
            state.searchQuery
        ) {
            searchTmdb(state.searchQuery, state.searchPage + 1);
        }
    });
}

function updateSearchPagination() {
    const pagination = document.getElementById("search-pagination");
    const previousButton = document.getElementById("search-prev-page");
    const nextButton = document.getElementById("search-next-page");
    const pageInfo = document.getElementById("search-page-info");

    if (!pagination || !previousButton || !nextButton || !pageInfo) {
        return;
    }

    pagination.hidden = state.searchTotalPages <= 1;
    previousButton.disabled = state.searchPage <= 1;
    nextButton.disabled =
        state.searchPage >= state.searchTotalPages;

    pageInfo.textContent =
        "Pagina " + state.searchPage +
        " van " + state.searchTotalPages;
}

function resetSearchPagination() {
    state.searchQuery = "";
    state.searchPage = 1;
    state.searchTotalPages = 1;

    const pagination = document.getElementById("search-pagination");

    if (pagination) {
        pagination.hidden = true;
    }
}

function renderSearchResults(results) {
    const container = document.getElementById("search-results");
    container.innerHTML = "";

    if (!results.length) {
        resetSearchResults("Geen resultaten gevonden.");
        return;
    }

    results.forEach((item) => {
        const card = document.createElement("article");
        const image = createResultImage(item);
        const copy = document.createElement("div");
        const title = document.createElement("h3");
        const meta = document.createElement("p");
        const selectButton = document.createElement("button");

        card.className = "result-card";
        copy.className = "result-copy";
        selectButton.className = "result-select";
        selectButton.type = "button";
        selectButton.textContent = "Selecteren";

        title.textContent = getResultTitle(item);
        meta.textContent = getResultMeta(item);

        copy.appendChild(title);
        copy.appendChild(meta);
        card.appendChild(image);
        card.appendChild(copy);
        card.appendChild(selectButton);

        selectButton.addEventListener("click", () => {
            document.querySelectorAll(".result-card").forEach((resultCard) => {
                resultCard.classList.remove("is-selected");
            });
            card.classList.add("is-selected");
            selectTmdbResult(item);
        });

        container.appendChild(card);
    });
}

function createResultImage(item) {
    const path = state.type === "person"
        ? item.profile_path
        : item.poster_path;

    if (path) {
        const image = document.createElement("img");
        image.className = "result-image";
        image.src = "https://image.tmdb.org/t/p/w185" + path;
        image.alt = "";
        image.loading = "lazy";
        return image;
    }

    const placeholder = document.createElement("div");
    placeholder.className = "result-placeholder";
    placeholder.textContent = state.type === "person" ? "👤" : "🎬";
    return placeholder;
}

function getResultTitle(item) {
    if (state.type === "person") {
        return item.name || "Onbekende acteur";
    }

    return item.title || item.name || "Titel onbekend";
}

function getResultMeta(item) {
    if (state.type === "person") {
        return item.known_for_department || "Acteur";
    }

    const date = item.release_date || item.first_air_date || "";
    return (date ? date.slice(0, 4) : "Jaar onbekend") + " · TMDB " + item.id;
}


/* =========================================================
   STAP 3 - PREVIEW
========================================================= */

async function selectTmdbResult(item) {
    state.selectedResult = item;
    state.selectedDetails = null;
    state.selectedPersonProfilePath = null;

    setPreviewLoading(item);

    try {
        if (state.type === "person") {
            const details = await fetchTmdbPersonDetails(item.id);
            state.selectedDetails = details;
            renderPersonPreview(details);
        } else {
            const details = await fetchTmdbTitleDetails(state.type, item.id);
            state.selectedDetails = details;
            renderTitlePreview(details);
        }

        document.getElementById("add-selected-button").disabled =
            !state.databaseHandle || !state.database;
    } catch (error) {
        console.error(error);
        showToast(
            "Details ophalen is mislukt: " +
                (error.message || "onbekende fout"),
            "error"
        );
        resetPreview();
    }
}

async function fetchTmdbTitleDetails(type, id) {
    const response = await fetch(
        "https://api.themoviedb.org/3/" + type + "/" + encodeURIComponent(id) +
        "?api_key=" + encodeURIComponent(MOVIEMIND_API_KEY) +
        "&language=nl-NL&append_to_response=credits"
    );

    if (!response.ok) {
        throw new Error("TMDB gaf foutcode " + response.status + ".");
    }

    return response.json();
}

async function fetchTmdbPersonDetails(id) {
    const response = await fetch(
        "https://api.themoviedb.org/3/person/" + encodeURIComponent(id) +
        "?api_key=" + encodeURIComponent(MOVIEMIND_API_KEY) +
        "&language=nl-NL&append_to_response=images,movie_credits,tv_credits"
    );

    if (!response.ok) {
        throw new Error("TMDB gaf foutcode " + response.status + ".");
    }

    return response.json();
}

function setPreviewLoading(item) {
    document.getElementById("preview-title").textContent = getResultTitle(item);
    document.getElementById("preview-meta").textContent = "Details worden opgehaald...";
    document.getElementById("preview-overview").textContent = "";
    document.getElementById("people-grid").innerHTML =
        '<div class="people-empty">Afbeeldingen worden geladen...</div>';
    document.getElementById("add-selected-button").disabled = true;
}

function renderTitlePreview(details) {
    const title = state.type === "tv"
        ? details.name || details.original_name
        : details.title || details.original_title;
    const date = state.type === "tv"
        ? details.first_air_date
        : details.release_date;
    const cast = details.credits && Array.isArray(details.credits.cast)
        ? details.credits.cast.slice(0, 8)
        : [];

    setPoster(details.poster_path, title);
    document.getElementById("preview-title").textContent = title || "Titel onbekend";
    document.getElementById("preview-meta").textContent =
        (date ? date.slice(0, 4) : "Jaar onbekend") +
        " · " +
        (state.type === "tv" ? "Serie" : "Film") +
        " · TMDB " + details.id;
    const overview = document.getElementById("preview-overview");
    overview.hidden = false;
    overview.textContent =
        details.overview || "Geen omschrijving beschikbaar.";
    document.getElementById("people-count").textContent =
        cast.length + " geselecteerd";

    renderPeople(cast);
}

function renderPersonPreview(details) {
    const profiles = details.images && Array.isArray(details.images.profiles)
        ? details.images.profiles
            .filter((profile) => profile && profile.file_path)
            .slice(0, 8)
        : [];

    state.selectedPersonProfilePath =
        details.profile_path ||
        (profiles[0] ? profiles[0].file_path : null);

    setPoster(state.selectedPersonProfilePath, details.name);
    document.getElementById("preview-title").textContent =
        details.name || "Acteur onbekend";
    document.getElementById("preview-meta").textContent =
        (details.known_for_department || "Acting") +
        " · TMDB " + details.id;
    const overview = document.getElementById("preview-overview");
    overview.textContent = "";
    overview.hidden = true;
    document.getElementById("people-count").textContent =
        profiles.length
            ? "Kies 1 van " + profiles.length + " foto's"
            : "Geen extra foto's gevonden";

    renderPersonProfiles(profiles, details.name);
}

function setPoster(path, title) {
    const image = document.getElementById("preview-poster");
    const placeholder = document.getElementById("poster-placeholder");

    if (!path) {
        image.hidden = true;
        image.removeAttribute("src");
        placeholder.hidden = false;
        return;
    }

    image.src = "https://image.tmdb.org/t/p/w500" + path;
    image.alt = "Afbeelding van " + (title || "de geselecteerde titel");
    image.hidden = false;
    placeholder.hidden = true;
}

function renderPeople(cast) {
    const container = document.getElementById("people-grid");
    container.innerHTML = "";

    if (!cast.length) {
        container.innerHTML =
            '<div class="people-empty">Geen acteurs gevonden.</div>';
        return;
    }

    cast.forEach((person) => {
        const card = document.createElement("article");
        const image = person.profile_path
            ? document.createElement("img")
            : document.createElement("div");
        const name = document.createElement("p");

        card.className = "person-card";

        if (person.profile_path) {
            image.src = "https://image.tmdb.org/t/p/w185" + person.profile_path;
            image.alt = "";
            image.loading = "lazy";
        } else {
            image.className = "person-placeholder";
            image.textContent = "👤";
        }

        name.textContent = person.name || "Onbekend";
        card.appendChild(image);
        card.appendChild(name);
        container.appendChild(card);
    });
}

function renderPersonProfiles(profiles, personName) {
    const container = document.getElementById("people-grid");
    container.innerHTML = "";

    if (!profiles.length) {
        container.innerHTML =
            '<div class="people-empty">Geen extra acteursfoto\'s gevonden.</div>';
        return;
    }

    profiles.forEach((profile, index) => {
        const card = document.createElement("button");
        const image = document.createElement("img");
        const label = document.createElement("p");

        card.className = "person-card";
        card.type = "button";
        card.setAttribute(
            "aria-label",
            "Kies foto " + (index + 1) + " van " + (personName || "de acteur")
        );

        image.src =
            "https://image.tmdb.org/t/p/w342" + profile.file_path;
        image.alt =
            "Foto " + (index + 1) + " van " + (personName || "de acteur");
        image.loading = "lazy";

        label.textContent = "Foto " + (index + 1);

        if (profile.file_path === state.selectedPersonProfilePath) {
            card.classList.add("is-selected");
            card.setAttribute("aria-pressed", "true");
            card.style.outline = "2px solid var(--gold)";
            card.style.outlineOffset = "1px";
        } else {
            card.setAttribute("aria-pressed", "false");
        }

        card.addEventListener("click", () => {
            state.selectedPersonProfilePath = profile.file_path;

            container.querySelectorAll(".person-card").forEach((item) => {
                item.classList.remove("is-selected");
                item.setAttribute("aria-pressed", "false");
                item.style.outline = "";
                item.style.outlineOffset = "";
            });

            card.classList.add("is-selected");
            card.setAttribute("aria-pressed", "true");
            card.style.outline = "2px solid var(--gold)";
            card.style.outlineOffset = "1px";

            setPoster(profile.file_path, personName);
            document.getElementById("people-count").textContent =
                "Foto " + (index + 1) + " geselecteerd";
        });

        card.appendChild(image);
        card.appendChild(label);
        container.appendChild(card);
    });
}


/* =========================================================
   ACTEURSMAP KOPPELEN
========================================================= */

function initialiseActorsFolderButtons() {
    const connectButton =
        document.getElementById("connect-actors-folder-button");
    const reconnectButton =
        document.getElementById("reconnect-actors-folder-button");

    if (connectButton) {
        connectButton.addEventListener(
            "click",
            connectActorsFolder
        );
    }

    if (reconnectButton) {
        reconnectButton.addEventListener(
            "click",
            requestSavedActorsFolderPermission
        );
    }
}

async function connectActorsFolder() {
    if (!("showDirectoryPicker" in window)) {
        showToast(
            "Gebruik Chrome of Edge. Deze browser ondersteunt rechtstreeks opslaan in een map niet.",
            "error"
        );
        return;
    }

    try {
        const handle = await window.showDirectoryPicker({
            mode: "readwrite"
        });

        if (!handle) {
            return;
        }

        const permission = await ensurePermission(handle, true);

        if (!permission) {
            throw new Error(
                "Geen lees- en schrijftoestemming gekregen."
            );
        }

        state.actorsFolderHandle = handle;
        await saveStoredHandle(
            ACTORS_FOLDER_HANDLE_KEY,
            handle
        );

        updateActorsFolderUi("online");

        showToast(
            "Acteursmap gekoppeld en onthouden.",
            "success"
        );
    } catch (error) {
        if (error && error.name === "AbortError") {
            return;
        }

        console.error(error);
        showToast(
            "Acteursmap koppelen is mislukt: " +
                (error.message || "onbekende fout"),
            "error"
        );
    }
}

async function restoreActorsFolderConnection() {
    try {
        const handle = await getStoredHandle(
            ACTORS_FOLDER_HANDLE_KEY
        );

        if (!handle) {
            updateActorsFolderUi("offline");
            return;
        }

        state.actorsFolderHandle = handle;

        const permission = await ensurePermission(
            handle,
            false
        );

        if (!permission) {
            updateActorsFolderUi("permission");
            return;
        }

        updateActorsFolderUi("online");
    } catch (error) {
        console.warn(
            "Acteursmap automatisch herstellen mislukt:",
            error
        );
        updateActorsFolderUi("permission");
    }
}

async function requestSavedActorsFolderPermission() {
    if (!state.actorsFolderHandle) {
        connectActorsFolder();
        return;
    }

    try {
        const permission = await ensurePermission(
            state.actorsFolderHandle,
            true
        );

        if (!permission) {
            throw new Error("Toestemming is niet verleend.");
        }

        updateActorsFolderUi("online");
        showToast(
            "Acteursmap opnieuw verbonden.",
            "success"
        );
    } catch (error) {
        showToast(
            "Opnieuw verbinden is mislukt: " +
                (error.message || "onbekende fout"),
            "error"
        );
    }
}

function updateActorsFolderUi(stateName) {
    const connectButton =
        document.getElementById("connect-actors-folder-button");
    const reconnectButton =
        document.getElementById("reconnect-actors-folder-button");
    const status =
        document.getElementById("actors-folder-status");

    if (stateName === "online") {
        if (connectButton) {
            connectButton.textContent =
                "📁 Andere acteursmap kiezen";
        }

        if (reconnectButton) {
            reconnectButton.hidden = true;
        }

        if (status) {
            status.textContent =
                (state.actorsFolderHandle
                    ? state.actorsFolderHandle.name
                    : "Acteursmap") +
                " is gekoppeld.";
        }
    } else if (stateName === "permission") {
        if (connectButton) {
            connectButton.textContent =
                "📁 Andere acteursmap kiezen";
        }

        if (reconnectButton) {
            reconnectButton.hidden = false;
        }

        if (status) {
            status.textContent =
                "De acteursmap is onthouden, maar toestemming is opnieuw nodig.";
        }
    } else {
        if (connectButton) {
            connectButton.textContent =
                "📁 Acteursmap koppelen";
        }

        if (reconnectButton) {
            reconnectButton.hidden = true;
        }

        if (status) {
            status.textContent =
                "Nog geen acteursmap gekoppeld.";
        }
    }
}

async function saveActorPhotoToConnectedFolder(
    details
) {
    if (!state.actorsFolderHandle) {
        throw new Error(
            "koppel eerst de map game/images/actors in Stap 4"
        );
    }

    const permission = await ensurePermission(
        state.actorsFolderHandle,
        true
    );

    if (!permission) {
        throw new Error(
            "geen toestemming om in de acteursmap te schrijven"
        );
    }

    const profilePath =
        state.selectedPersonProfilePath ||
        details.profile_path ||
        null;

    if (!profilePath) {
        throw new Error(
            "voor deze acteur is geen foto geselecteerd"
        );
    }

    const filename =
        createActorPhotoBaseName(
            details.name || "onbekende_acteur"
        ) + ".jpg";

    const response = await fetch(
        "https://image.tmdb.org/t/p/original" +
            profilePath
    );

    if (!response.ok) {
        throw new Error(
            "TMDB gaf foutcode " + response.status
        );
    }

    const imageBlob = await response.blob();
    const fileHandle =
        await state.actorsFolderHandle.getFileHandle(
            filename,
            { create: true }
        );
    const writable = await fileHandle.createWritable();

    try {
        await writable.write(imageBlob);
        await writable.close();
    } catch (error) {
        try {
            await writable.abort();
        } catch (_) {
            // Geen aanvullende actie nodig.
        }

        throw error;
    }

    return filename;
}


/* =========================================================
   STAP 4 - DATABASEKOPPELING
========================================================= */

function initialiseMaintenance() {
    const card = document.getElementById("maintenance-card");
    const toggle = document.getElementById("maintenance-toggle");

    toggle.addEventListener("click", () => {
        const collapsed = card.classList.toggle("is-collapsed");
        toggle.setAttribute("aria-expanded", String(!collapsed));
    });
}

function initialiseDatabaseButtons() {
    const connectButton = document.getElementById("connect-database-button");
    const reconnectButton = document.getElementById("reconnect-database-button");
    const testSaveButton = document.getElementById("test-save-button");
    const reloadButton = document.getElementById("reload-database-button");

    if (connectButton) {
        connectButton.addEventListener("click", connectDatabase);
    }

    if (reconnectButton) {
        reconnectButton.addEventListener("click", requestSavedDatabasePermission);
    }

    if (testSaveButton) {
        testSaveButton.addEventListener("click", testDatabaseWriteAccess);
    }

    if (reloadButton) {
        reloadButton.addEventListener("click", reloadConnectedDatabase);
    }
}

async function connectDatabase() {
    if (!("showOpenFilePicker" in window)) {
        showToast(
            "Gebruik Chrome of Edge. Deze browser ondersteunt rechtstreeks opslaan niet.",
            "error"
        );
        return;
    }

    try {
        const [handle] = await window.showOpenFilePicker({
            multiple: false,
            types: [{
                description: "MovieMind gecombineerde database",
                accept: { "application/json": [".json"] }
            }]
        });

        if (!handle) {
            return;
        }

        const permission = await ensurePermission(handle, true);

        if (!permission) {
            throw new Error("Geen lees- en schrijftoestemming gekregen.");
        }

        await loadDatabaseFromHandle(handle);
        state.databaseHandle = handle;
        await saveHandle(handle);

        updateDatabaseConnectionUi("online");
        showToast(
            "Database gekoppeld en automatisch onthouden.",
            "success"
        );
    } catch (error) {
        if (error && error.name === "AbortError") {
            return;
        }

        console.error(error);
        showToast(
            "Database koppelen is mislukt: " +
                (error.message || "onbekende fout"),
            "error"
        );
    }
}

async function restoreDatabaseConnection() {
    try {
        const handle = await getSavedHandle();

        if (!handle) {
            updateDatabaseConnectionUi("offline");
            return;
        }

        state.databaseHandle = handle;
        const permission = await ensurePermission(handle, false);

        if (!permission) {
            updateDatabaseConnectionUi("permission");
            return;
        }

        await loadDatabaseFromHandle(handle);
        updateDatabaseConnectionUi("online");
    } catch (error) {
        console.warn("Automatisch herstellen mislukt:", error);
        updateDatabaseConnectionUi("permission");
    }
}

async function requestSavedDatabasePermission() {
    if (!state.databaseHandle) {
        connectDatabase();
        return;
    }

    try {
        const permission = await ensurePermission(state.databaseHandle, true);

        if (!permission) {
            throw new Error("Toestemming is niet verleend.");
        }

        await loadDatabaseFromHandle(state.databaseHandle);
        updateDatabaseConnectionUi("online");
        showToast("Database opnieuw verbonden.", "success");
    } catch (error) {
        showToast(
            "Opnieuw verbinden is mislukt: " +
                (error.message || "onbekende fout"),
            "error"
        );
    }
}


async function reloadConnectedDatabase() {
    if (!state.databaseHandle) {
        showToast("Koppel eerst een database.", "error");
        return;
    }

    try {
        const permission = await ensurePermission(state.databaseHandle, true);

        if (!permission) {
            throw new Error("Geen toestemming om de database te lezen.");
        }

        await loadDatabaseFromHandle(state.databaseHandle);
        updateDatabaseConnectionUi("online");
        showToast("Database opnieuw geladen.", "success");
    } catch (error) {
        console.error(error);
        showToast(
            "Opnieuw laden is mislukt: " +
                (error.message || "onbekende fout"),
            "error"
        );
    }
}

async function ensurePermission(handle, requestPermission) {
    const options = { mode: "readwrite" };

    if (!handle.queryPermission) {
        return true;
    }

    let permission = await handle.queryPermission(options);

    if (permission === "granted") {
        return true;
    }

    if (requestPermission && handle.requestPermission) {
        permission = await handle.requestPermission(options);
        return permission === "granted";
    }

    return false;
}

function setTextIfPresent(id, value) {
    const element = document.getElementById(id);
    if (element) {
        element.textContent = value;
    }
}

async function loadDatabaseFromHandle(handle) {
    const file = await handle.getFile();
    const text = await file.text();
    const database = JSON.parse(text);
    const records = extractRecords(database);

    if (!records.length) {
        throw new Error("In deze database zijn geen films of series gevonden.");
    }

    state.database = database;
    state.records = records;
    state.databaseHandle = handle;

    updateStatistics(file);
    setTextIfPresent(
        "database-status",
        file.name + " is gekoppeld · " +
            records.length.toLocaleString("nl-NL") + " titels"
    );

    const addButton = document.getElementById("add-selected-button");
    if (addButton) {
        addButton.disabled = !state.selectedDetails;
    }
}

function extractRecords(database) {
    if (Array.isArray(database)) {
        return database;
    }

    if (database && Array.isArray(database.films)) {
        return database.films;
    }

    if (database && Array.isArray(database.titles)) {
        return database.titles;
    }

    return [];
}

function synchroniseDatabaseRecords() {
    if (Array.isArray(state.database)) {
        state.database = state.records;
        return;
    }

    if (state.database && Array.isArray(state.database.films)) {
        state.database.films = state.records;
        return;
    }

    if (state.database && Array.isArray(state.database.titles)) {
        state.database.titles = state.records;
        return;
    }

    throw new Error("De databasestructuur wordt niet ondersteund.");
}

async function writeDatabase() {
    if (!state.databaseHandle || !state.database) {
        throw new Error("Koppel eerst de MovieMind-database in Stap 4.");
    }

    const permission = await ensurePermission(state.databaseHandle, true);

    if (!permission) {
        throw new Error("MovieMind heeft geen schrijftoestemming.");
    }

    synchroniseDatabaseRecords();

    const writable = await state.databaseHandle.createWritable();

    try {
        await writable.write(JSON.stringify(state.database, null, 2));
        await writable.close();
    } catch (error) {
        try {
            await writable.abort();
        } catch (_) {
            // Geen aanvullende actie nodig.
        }
        throw error;
    }
}

async function testDatabaseWriteAccess() {
    try {
        await writeDatabase();
        showToast("Schrijftoegang werkt correct.", "success");
    } catch (error) {
        showToast(
            "Schrijftest mislukt: " +
                (error.message || "onbekende fout"),
            "error"
        );
    }
}

function updateDatabaseConnectionUi(stateName) {
    const chip = document.getElementById("database-chip");
    const title = document.getElementById("database-chip-title");
    const text = document.getElementById("database-chip-text");
    const reconnect = document.getElementById("reconnect-database-button");
    const test = document.getElementById("test-save-button");
    const reload = document.getElementById("reload-database-button");

    if (chip) {
        chip.dataset.state = stateName;
    }

    if (stateName === "online") {
        setTextIfPresent("database-chip-title", "Database actief");
        setTextIfPresent(
            "database-chip-text",
            state.databaseHandle
                ? state.databaseHandle.name
                : "MovieMind-database"
        );

        if (reconnect) reconnect.hidden = true;
        if (test) test.disabled = false;
        if (reload) reload.disabled = false;
    } else if (stateName === "permission") {
        setTextIfPresent("database-chip-title", "Toestemming nodig");
        setTextIfPresent(
            "database-chip-text",
            "Klik eenmaal om opnieuw te verbinden"
        );

        if (reconnect) reconnect.hidden = false;
        if (test) test.disabled = true;
        if (reload) reload.disabled = true;
    } else {
        setTextIfPresent("database-chip-title", "Geen database gekoppeld");
        setTextIfPresent(
            "database-chip-text",
            "Open Stap 4 om te koppelen"
        );

        if (reconnect) reconnect.hidden = true;
        if (test) test.disabled = true;
        if (reload) reload.disabled = true;
    }
}

function updateStatistics(file = null) {
    let movies = 0;
    let series = 0;
    const actors = new Set();
    const directors = new Set();

    state.records.forEach((record) => {
        const type = String(
            record.media_type || record.type || record.mediaType || ""
        ).toLowerCase();

        if (["tv", "series", "serie", "show"].includes(type)) {
            series += 1;
        } else if (type !== "person" && type !== "actor") {
            movies += 1;
        }

        collectUniqueNames(actors, record.actors);
        collectUniqueNames(actors, record.cast);
        collectUniqueNames(actors, record.cast_details);

        collectUniqueNames(directors, record.director);
        collectUniqueNames(directors, record.directors);
        collectUniqueNames(directors, record.director_details);
    });

    setTextIfPresent("stat-total", state.records.length.toLocaleString("nl-NL"));
    setTextIfPresent("stat-movies", movies.toLocaleString("nl-NL"));
    setTextIfPresent("stat-series", series.toLocaleString("nl-NL"));
    setTextIfPresent("stat-actors", actors.size.toLocaleString("nl-NL"));
    setTextIfPresent("stat-directors", directors.size.toLocaleString("nl-NL"));

    const modifiedText = file && Number.isFinite(file.lastModified)
        ? new Intl.DateTimeFormat("nl-NL", {
            dateStyle: "short",
            timeStyle: "short"
        }).format(new Date(file.lastModified))
        : "—";

    setTextIfPresent("stat-modified", modifiedText);
}

function collectUniqueNames(targetSet, values) {
    if (values === null || values === undefined) {
        return;
    }

    const list = Array.isArray(values) ? values : [values];

    list.forEach((value) => {
        const rawName = typeof value === "object" && value !== null
            ? value.name || value.actor || value.title || ""
            : value;
        const normalised = String(rawName || "").trim().toLocaleLowerCase("nl-NL");

        if (normalised) {
            targetSet.add(normalised);
        }
    });
}



/* =========================================================
   TOEVOEGEN EN DIRECT OPSLAAN
========================================================= */

function initialiseAddButton() {
    document
        .getElementById("add-selected-button")
        .addEventListener("click", addSelectedResult);
}

async function addSelectedResult() {
    const button = document.getElementById("add-selected-button");

    if (!state.selectedDetails) {
        showToast("Selecteer eerst een resultaat.", "error");
        return;
    }

    if (!state.databaseHandle || !state.database) {
        showToast("Koppel eerst de database in Stap 4.", "error");
        return;
    }

    const record = state.type === "person"
        ? createPersonRecord(state.selectedDetails)
        : createTitleRecord(state.selectedDetails);

    if (isDuplicateRecord(record)) {
        if (state.type === "person") {
            try {
                const downloadedFilename =
                    await saveActorPhotoToConnectedFolder(state.selectedDetails);

                showToast(
                    record.title +
                        " staat al in de database. De foto is opgeslagen als " +
                        downloadedFilename +
                        ".",
                    "success"
                );
            } catch (error) {
                console.error(error);
                showToast(
                    record.title +
                        " staat al in de database, maar de foto kon niet worden gedownload: " +
                        (error.message || "onbekende fout"),
                    "error"
                );
            }
            return;
        }

        showToast(record.title + " staat al in de database.", "error");
        return;
    }

    button.disabled = true;
    button.textContent = "Opslaan...";

    state.records.push(record);

    try {
        await writeDatabase();
        const refreshedFile = await state.databaseHandle.getFile();
        updateStatistics(refreshedFile);
        if (state.type === "person") {
            try {
                const downloadedFilename =
                    await saveActorPhotoToConnectedFolder(state.selectedDetails);

                showToast(
                    record.title +
                        " is toegevoegd. De foto is opgeslagen als " +
                        downloadedFilename +
                        ".",
                    "success"
                );
            } catch (photoError) {
                console.error(photoError);
                showToast(
                    record.title +
                        " is toegevoegd, maar de foto kon niet worden gedownload: " +
                        (photoError.message || "onbekende fout"),
                    "error"
                );
            }
        } else {
            showToast(
                record.title + " is toegevoegd en opgeslagen.",
                "success"
            );
        }

        button.textContent = "✓ Toegevoegd";
    } catch (error) {
        state.records = state.records.filter((item) => item !== record);
        console.error(error);
        showToast(
            "Toevoegen is mislukt: " +
                (error.message || "onbekende fout"),
            "error"
        );
        button.disabled = false;
        button.textContent = "＋ Toevoegen aan MovieMind";
    }
}

function createTitleRecord(details) {
    const cast = details.credits && Array.isArray(details.credits.cast)
        ? details.credits.cast.slice(0, 8)
        : [];
    const crew = details.credits && Array.isArray(details.credits.crew)
        ? details.credits.crew
        : [];
    const directors = crew.filter((person) => person.job === "Director");
    const isTv = state.type === "tv";

    return {
        id: details.id,
        title: isTv
            ? details.name || details.original_name
            : details.title || details.original_title,
        year: Number(
            ((isTv ? details.first_air_date : details.release_date) || "")
                .slice(0, 4)
        ) || null,
        genre: (details.genres || []).map((genre) => genre.name),
        director: directors.map((person) => person.name),
        actors: cast.map((person) => person.name).filter(Boolean),
        characters: cast.map((person) => person.character || ""),
        poster_path: details.poster_path || null,
        backdrop_path: details.backdrop_path || null,
        overview: details.overview || "",
        rating: Number(details.vote_average || 0),
        runtime: isTv
            ? (details.episode_run_time || [])[0] || null
            : details.runtime || null,
        cast_details: cast.map((person) => ({
            id: person.id,
            name: person.name,
            character: person.character || "",
            profile_path: person.profile_path || null
        })),
        director_details: directors.map((person) => ({
            id: person.id,
            name: person.name,
            profile_path: person.profile_path || null
        })),
        fullDetails: true,
        media_type: isTv ? "tv" : "movie"
    };
}


function createActorPhotoBaseName(personName) {
    return String(personName || "")
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/['’`]/g, "")
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .replace(/_+/g, "_");
}

async function downloadSelectedActorPhoto(details) {
    const profilePath =
        state.selectedPersonProfilePath ||
        details.profile_path ||
        null;

    if (!profilePath) {
        throw new Error("voor deze acteur is geen foto geselecteerd");
    }

    const filename =
        createActorPhotoBaseName(details.name || "onbekende_acteur") +
        ".jpg";

    const response = await fetch(
        "https://image.tmdb.org/t/p/original" + profilePath
    );

    if (!response.ok) {
        throw new Error("TMDB gaf foutcode " + response.status);
    }

    const imageBlob = await response.blob();
    const objectUrl = URL.createObjectURL(imageBlob);
    const downloadLink = document.createElement("a");

    downloadLink.href = objectUrl;
    downloadLink.download = filename;
    downloadLink.style.display = "none";

    document.body.appendChild(downloadLink);
    downloadLink.click();
    downloadLink.remove();

    window.setTimeout(() => {
        URL.revokeObjectURL(objectUrl);
    }, 1000);

    return filename;
}

function createPersonRecord(details) {
    return {
        id: "person-" + details.id,
        title: details.name || "Onbekende acteur",
        year: details.birthday
            ? Number(details.birthday.slice(0, 4))
            : null,
        genre: ["Acteur"],
        director: [],
        actors: [details.name],
        characters: [],
        poster_path:
            state.selectedPersonProfilePath ||
            details.profile_path ||
            null,
        overview: details.biography || "",
        rating: 0,
        runtime: null,
        cast_details: [{
            id: details.id,
            name: details.name,
            character: "",
            profile_path:
                state.selectedPersonProfilePath ||
                details.profile_path ||
                null
        }],
        fullDetails: true,
        media_type: "person"
    };
}

function isDuplicateRecord(record) {
    return state.records.some((existing) => {
        return String(existing.id) === String(record.id) ||
            (
                String(existing.title || "").toLowerCase() ===
                    String(record.title || "").toLowerCase() &&
                String(existing.media_type || "") ===
                    String(record.media_type || "")
            );
    });
}


/* =========================================================
   INDEXEDDB - ALLEEN BESTANDSHANDLE ONTHOUDEN
========================================================= */

function openSettingsDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = () => {
            if (!request.result.objectStoreNames.contains(HANDLE_STORE)) {
                request.result.createObjectStore(HANDLE_STORE);
            }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function saveStoredHandle(key, handle) {
    const database = await openSettingsDatabase();

    return new Promise((resolve, reject) => {
        const transaction =
            database.transaction(
                HANDLE_STORE,
                "readwrite"
            );

        transaction
            .objectStore(HANDLE_STORE)
            .put(handle, key);

        transaction.oncomplete = () => {
            database.close();
            resolve();
        };

        transaction.onerror = () => {
            const error = transaction.error;
            database.close();
            reject(error);
        };
    });
}

async function getStoredHandle(key) {
    const database = await openSettingsDatabase();

    return new Promise((resolve, reject) => {
        const transaction =
            database.transaction(
                HANDLE_STORE,
                "readonly"
            );

        const request =
            transaction
                .objectStore(HANDLE_STORE)
                .get(key);

        request.onsuccess = () => {
            database.close();
            resolve(request.result || null);
        };

        request.onerror = () => {
            const error = request.error;
            database.close();
            reject(error);
        };
    });
}

async function saveHandle(handle) {
    const database = await openSettingsDatabase();

    return new Promise((resolve, reject) => {
        const transaction = database.transaction(HANDLE_STORE, "readwrite");
        transaction.objectStore(HANDLE_STORE).put(
            handle,
            DATABASE_HANDLE_KEY
        );
        transaction.oncomplete = () => {
            database.close();
            resolve();
        };
        transaction.onerror = () => {
            database.close();
            reject(transaction.error);
        };
    });
}

async function getSavedHandle() {
    const database = await openSettingsDatabase();

    return new Promise((resolve, reject) => {
        const transaction = database.transaction(HANDLE_STORE, "readonly");
        const request = transaction
            .objectStore(HANDLE_STORE)
            .get(DATABASE_HANDLE_KEY);

        request.onsuccess = () => {
            database.close();
            resolve(request.result || null);
        };
        request.onerror = () => {
            database.close();
            reject(request.error);
        };
    });
}


/* =========================================================
   ALGEMENE HULPFUNCTIES
========================================================= */

function setSearchStatus(message, type = "") {
    const status = document.getElementById("search-status");
    status.textContent = message;
    status.className = "search-status" + (type ? " is-" + type : "");
}

function renderLoadingState() {
    document.getElementById("search-results").innerHTML =
        '<div class="empty-state"><span>⏳</span><strong>Even zoeken...</strong></div>';
}

function resetSearchResults(message = "") {
    document.getElementById("search-results").innerHTML =
        '<div class="empty-state">' +
            '<span>🔎</span>' +
            '<strong>' + (message || "Nog geen zoekresultaten") + '</strong>' +
            '<p>Zoek hierboven naar een film, serie of acteur.</p>' +
        '</div>';
}

function resetPreview() {
    state.selectedResult = null;
    state.selectedDetails = null;
    state.selectedPersonProfilePath = null;

    const image = document.getElementById("preview-poster");
    image.hidden = true;
    image.removeAttribute("src");

    document.getElementById("poster-placeholder").hidden = false;
    document.getElementById("preview-title").textContent =
        "Nog geen titel geselecteerd";
    document.getElementById("preview-meta").textContent =
        "Kies een resultaat uit Stap 2.";
    document.getElementById("preview-overview").textContent = "";
    document.getElementById("people-count").textContent = "0 geselecteerd";
    document.getElementById("people-grid").innerHTML =
        '<div class="people-empty">Acteursfoto\'s verschijnen hier.</div>';

    const button = document.getElementById("add-selected-button");
    button.disabled = true;
    button.textContent = "＋ Toevoegen aan MovieMind";
}

let toastTimer = null;

function showToast(message, type = "") {
    const toast = document.getElementById("toast");
    window.clearTimeout(toastTimer);

    toast.textContent = message;
    toast.className = "toast" + (type ? " is-" + type : "");
    toast.hidden = false;

    toastTimer = window.setTimeout(() => {
        toast.hidden = true;
    }, 5000);
}