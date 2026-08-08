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
    searchTotalPages: 1,
    selectedFilmographyCredits: new Map(),
    showOnlyMissingFilmography: false
};

const DB_NAME = "MovieMindStudio2";
const DB_VERSION = 1;
const HANDLE_STORE = "handles";
const DATABASE_HANDLE_KEY = "mainDatabase";
const ACTORS_FOLDER_HANDLE_KEY = "actorsFolder";
const SELECTED_TYPE_KEY = "moviemindStudioSelectedType";
const ACTIVITY_LOG_KEY = "moviemindStudioActivityLog";
const RECENT_ITEMS_KEY = "moviemindStudioRecentItems";
const MAX_LOG_ITEMS = 10;
const BULK_PHOTO_MIN_SCORE = 50;
const BULK_PHOTO_MAX_SCORE = 69;
const ANALYZER_POPULARITY_CACHE_KEY = "moviemindAnalyzerActorPopularity";
const BULK_PHOTO_PROGRESS_STORAGE_KEY = "moviemindStudioBulkPhotoProgress50_69V2";
let bulkScorePhotoRunActive = false;

document.addEventListener("DOMContentLoaded", () => {
    restoreSelectedType();
    initialiseTypeButtons();
    applySelectedTypeToUi();
    initialiseSearch();
    initialiseSearchPagination();
    initialiseMaintenance();
    initialiseDatabaseButtons();
    initialiseActorsFolderButtons();
    initialiseBulkScorePhotoButton();
    initialiseAddButton();
    initialiseActivityLog();
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
    setFilmographyVisibility(false);

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
    renderPersonFilmography(details);
}

function setFilmographyVisibility(visible) {
    const section = document.getElementById("filmography-section");

    if (section) {
        section.hidden = !visible;
    }
}

function renderPersonFilmography(details) {
    const movieCredits = details.movie_credits &&
        Array.isArray(details.movie_credits.cast)
        ? details.movie_credits.cast.map((credit) => ({
            ...credit,
            media_type: "movie"
        }))
        : [];
    const tvCredits = details.tv_credits &&
        Array.isArray(details.tv_credits.cast)
        ? details.tv_credits.cast.map((credit) => ({
            ...credit,
            media_type: "tv"
        }))
        : [];

    const seen = new Set();
    const credits = [...movieCredits, ...tvCredits]
        .filter(isRelevantMovieMindTitle)
        .filter((credit) => {
            if (!credit || !credit.id) {
                return false;
            }

            const key = credit.media_type + ":" + credit.id;

            if (seen.has(key)) {
                return false;
            }

            seen.add(key);
            return true;
        })
        .sort((a, b) => {
            const dateA =
                Date.parse(a.release_date || a.first_air_date || "") || 0;
            const dateB =
                Date.parse(b.release_date || b.first_air_date || "") || 0;

            if (dateB !== dateA) {
                return dateB - dateA;
            }

            const popularityDifference =
                Number(b.popularity || 0) -
                Number(a.popularity || 0);

            if (popularityDifference !== 0) {
                return popularityDifference;
            }

            return String(
                a.title ||
                a.name ||
                a.original_title ||
                a.original_name ||
                ""
            ).localeCompare(
                String(
                    b.title ||
                    b.name ||
                    b.original_title ||
                    b.original_name ||
                    ""
                ),
                "nl"
            );
        })
        .slice(0, 100);

    const container = document.getElementById("filmography-list");
    const count = document.getElementById("filmography-count");
    const visibleCredits = state.showOnlyMissingFilmography
        ? credits.filter((credit) => !isFilmographyCreditInDatabase(credit))
        : credits;

    state.selectedFilmographyCredits.clear();
    setFilmographyVisibility(true);
    ensureFilmographyBulkControls();
    updateFilmographyMissingFilter();

    if (!container || !count) {
        return;
    }

    container.innerHTML = "";

    if (state.showOnlyMissingFilmography) {
        count.textContent = visibleCredits.length === 1
            ? "1 ontbrekende titel"
            : visibleCredits.length + " ontbrekende titels";
    } else {
        count.textContent = credits.length === 1
            ? "1 titel"
            : credits.length + " titels";
    }

    if (!visibleCredits.length) {
        container.innerHTML = state.showOnlyMissingFilmography
            ? '<div class="filmography-empty">Alle gevonden films en series staan al in MovieMind.</div>'
            : '<div class="filmography-empty">Geen films of series gevonden.</div>';
        updateFilmographyBulkButton();
        return;
    }

    visibleCredits.forEach((credit) => {
        const item = document.createElement("article");
        const checkbox = document.createElement("input");
        const image = credit.poster_path
            ? document.createElement("img")
            : document.createElement("div");
        const copy = document.createElement("div");
        const title = document.createElement("strong");
        const meta = document.createElement("span");
        const badge = document.createElement("span");
        const name =
            credit.title ||
            credit.name ||
            credit.original_title ||
            credit.original_name ||
            "Titel onbekend";
        const year = getFilmographyYear(credit);
        const mediaLabel =
            credit.media_type === "tv" ? "Serie" : "Film";
        const key =
            credit.media_type + ":" + credit.id;
        const alreadyInDatabase =
            isFilmographyCreditInDatabase(credit);

        item.className = "filmography-item";
        item.style.gridTemplateColumns =
            "24px 48px minmax(0, 1fr) auto";

        checkbox.type = "checkbox";
        checkbox.className = "filmography-checkbox";
        checkbox.value = key;
        checkbox.setAttribute(
            "aria-label",
            name + " selecteren"
        );
        checkbox.style.width = "18px";
        checkbox.style.height = "18px";
        checkbox.style.accentColor = "var(--gold)";
        checkbox.style.cursor =
            alreadyInDatabase ? "not-allowed" : "pointer";
        checkbox.disabled = alreadyInDatabase;

        copy.className = "filmography-copy";
        badge.className = "filmography-badge";
        badge.textContent = alreadyInDatabase
            ? "✓ Al toegevoegd"
            : credit.media_type === "tv"
                ? "📺 Serie"
                : "🎬 Film";

        if (alreadyInDatabase) {
            item.style.opacity = "0.62";
        }

        if (credit.poster_path) {
            image.className = "filmography-poster";
            image.src =
                "https://image.tmdb.org/t/p/w92" +
                credit.poster_path;
            image.alt = "Poster van " + name;
            image.loading = "lazy";
        } else {
            image.className =
                "filmography-poster filmography-poster-placeholder";
            image.textContent =
                credit.media_type === "tv" ? "📺" : "🎬";
        }

        title.textContent = name;
        meta.textContent =
            (year || "Jaar onbekend") +
            " · " + mediaLabel +
            (credit.character
                ? " · " + credit.character
                : "");

        checkbox.addEventListener("change", () => {
            if (checkbox.checked) {
                state.selectedFilmographyCredits.set(
                    key,
                    credit
                );
                item.style.background =
                    "rgba(74, 18, 24, .48)";
            } else {
                state.selectedFilmographyCredits.delete(key);
                item.style.background = "";
            }

            updateFilmographyBulkButton();
        });

        item.appendChild(checkbox);
        item.appendChild(image);
        copy.appendChild(title);
        copy.appendChild(meta);
        item.appendChild(copy);
        item.appendChild(badge);
        container.appendChild(item);
    });

    updateFilmographyBulkButton();
}

function ensureFilmographyBulkControls() {
    const section =
        document.getElementById("filmography-section");

    if (!section) {
        return;
    }

    let filterControls =
        document.getElementById("filmography-filter-controls");

    if (!filterControls) {
        filterControls = document.createElement("label");
        filterControls.id = "filmography-filter-controls";
        filterControls.style.display = "inline-flex";
        filterControls.style.alignItems = "center";
        filterControls.style.gap = "8px";
        filterControls.style.marginTop = "12px";
        filterControls.style.cursor = "pointer";
        filterControls.style.color = "var(--text-muted)";
        filterControls.style.fontSize = "14px";

        const missingCheckbox = document.createElement("input");
        missingCheckbox.id = "show-only-missing-filmography";
        missingCheckbox.type = "checkbox";
        missingCheckbox.style.width = "18px";
        missingCheckbox.style.height = "18px";
        missingCheckbox.style.accentColor = "var(--gold)";

        const missingText = document.createElement("span");
        missingText.textContent = "Toon alleen ontbrekende films en series";

        missingCheckbox.addEventListener("change", () => {
            state.showOnlyMissingFilmography = missingCheckbox.checked;

            if (state.selectedDetails && state.type === "person") {
                renderPersonFilmography(state.selectedDetails);
            }
        });

        filterControls.appendChild(missingCheckbox);
        filterControls.appendChild(missingText);

        const list = document.getElementById("filmography-list");

        if (list) {
            section.insertBefore(filterControls, list);
        } else {
            section.appendChild(filterControls);
        }
    }

    let controls =
        document.getElementById("filmography-bulk-controls");

    if (!controls) {
        controls = document.createElement("div");
        controls.id = "filmography-bulk-controls";
        controls.style.display = "flex";
        controls.style.alignItems = "center";
        controls.style.justifyContent = "space-between";
        controls.style.gap = "12px";
        controls.style.marginTop = "12px";

        const selectedText =
            document.createElement("span");
        selectedText.id =
            "filmography-selected-count";
        selectedText.style.color = "var(--text-muted)";
        selectedText.style.fontSize = "13px";

        const button =
            document.createElement("button");
        button.id =
            "add-filmography-selected-button";
        button.type = "button";
        button.className = "primary-button";
        button.disabled = true;
        button.textContent =
            "＋ Geselecteerde titels toevoegen";

        button.addEventListener(
            "click",
            addSelectedFilmographyTitles
        );

        controls.appendChild(selectedText);
        controls.appendChild(button);
        section.appendChild(controls);
    }
}

function updateFilmographyMissingFilter() {
    const checkbox = document.getElementById(
        "show-only-missing-filmography"
    );

    if (checkbox) {
        checkbox.checked = state.showOnlyMissingFilmography;
        checkbox.disabled = !state.database;
    }
}

function updateFilmographyBulkButton() {
    const button =
        document.getElementById(
            "add-filmography-selected-button"
        );
    const count =
        document.getElementById(
            "filmography-selected-count"
        );
    const selectedCount =
        state.selectedFilmographyCredits.size;
    const databaseReady =
        Boolean(state.databaseHandle && state.database);

    if (count) {
        count.textContent = selectedCount === 1
            ? "1 titel geselecteerd"
            : selectedCount + " titels geselecteerd";
    }

    if (button) {
        button.disabled =
            selectedCount === 0 || !databaseReady;
        button.textContent = selectedCount
            ? "＋ " + selectedCount +
                (selectedCount === 1
                    ? " titel toevoegen"
                    : " titels toevoegen")
            : "＋ Geselecteerde titels toevoegen";
    }
}

function isFilmographyCreditInDatabase(credit) {
    const mediaType =
        credit.media_type === "tv" ? "tv" : "movie";

    return state.records.some((record) => {
        return String(record.id) === String(credit.id) &&
            normaliseMediaType(record.media_type) === mediaType;
    });
}

function normaliseMediaType(value) {
    const type = String(value || "").toLowerCase();

    if (["tv", "series", "serie", "show"].includes(type)) {
        return "tv";
    }

    return "movie";
}

async function addSelectedFilmographyTitles() {
    const button =
        document.getElementById(
            "add-filmography-selected-button"
        );
    const selectedCredits =
        Array.from(state.selectedFilmographyCredits.values());

    if (!selectedCredits.length) {
        showToast(
            "Selecteer eerst één of meer titels.",
            "error"
        );
        return;
    }

    if (!state.databaseHandle || !state.database) {
        showToast(
            "Koppel eerst de database in Stap 4.",
            "error"
        );
        return;
    }

    button.disabled = true;
    button.textContent = "Titels ophalen en toevoegen...";

    const addedRecords = [];
    let skipped = 0;
    let failed = 0;

    for (const credit of selectedCredits) {
        try {
            if (isFilmographyCreditInDatabase(credit)) {
                skipped += 1;
                continue;
            }

            const details = await fetchTmdbTitleDetails(
                credit.media_type,
                credit.id
            );
            const record = createTitleRecordForType(
                details,
                credit.media_type
            );

            if (isDuplicateRecord(record)) {
                skipped += 1;
                continue;
            }

            state.records.push(record);
            addedRecords.push(record);
        } catch (error) {
            console.error(
                "Filmografietitel toevoegen mislukt:",
                credit,
                error
            );
            failed += 1;
        }
    }

    if (!addedRecords.length) {
        updateFilmographyBulkButton();

        showToast(
            skipped
                ? "De geselecteerde titels staan al in de database."
                : "Geen titels konden worden toegevoegd.",
            "error"
        );
        return;
    }

    try {
        await writeDatabase();
        const refreshedFile =
            await state.databaseHandle.getFile();
        updateStatistics(refreshedFile);

        addedRecords.forEach(addRecentItem);
        state.selectedFilmographyCredits.clear();

        if (state.selectedDetails && state.type === "person") {
            renderPersonFilmography(state.selectedDetails);
        }

        let message =
            addedRecords.length === 1
                ? "1 titel is toegevoegd en opgeslagen."
                : addedRecords.length +
                    " titels zijn toegevoegd en opgeslagen.";

        if (skipped) {
            message += " " + skipped +
                (skipped === 1
                    ? " titel stond al in de database."
                    : " titels stonden al in de database.");
        }

        if (failed) {
            message += " " + failed +
                (failed === 1
                    ? " titel kon niet worden opgehaald."
                    : " titels konden niet worden opgehaald.");
        }

        showToast(message, "success");
    } catch (error) {
        addedRecords.forEach((record) => {
            state.records =
                state.records.filter(
                    (item) => item !== record
                );
        });

        console.error(error);
        showToast(
            "Opslaan is mislukt: " +
                (error.message || "onbekende fout"),
            "error"
        );
        updateFilmographyBulkButton();
    }
}


function isRelevantMovieMindTitle(credit) {
    if (!credit || !credit.id) {
        return false;
    }

    const title = String(
        credit.title ||
        credit.name ||
        credit.original_title ||
        credit.original_name ||
        ""
    ).toLocaleLowerCase("en-US");
    const character = String(
        credit.character || ""
    ).toLocaleLowerCase("en-US");
    const genreIds = Array.isArray(credit.genre_ids)
        ? credit.genre_ids.map(Number)
        : [];

    const blockedCharacterParts = [
        "self",
        "himself",
        "herself",
        "narrator",
        "host",
        "presenter",
        "interviewer",
        "interviewee",
        "archive footage",
        "archive audio",
        "voice of self",
        "contestant",
        "panelist",
        "guest",
        "judge"
    ];

    if (blockedCharacterParts.some((part) => character.includes(part))) {
        return false;
    }

    const blockedTitleParts = [
        "the tonight show",
        "tonight show",
        "jimmy kimmel live",
        "late night with",
        "late show with",
        "the late late show",
        "graham norton show",
        "the daily show",
        "good morning america",
        "live with kelly",
        "the view",

        // WWE-programma's, evenementen en specials.
        "wwe",
        "world wrestling entertainment",
        "world wrestling federation",
        "wrestlemania",
        "royal rumble",
        "survivor series",
        "summerslam",
        "summer slam",
        "money in the bank",
        "elimination chamber",
        "extreme rules",
        "clash of champions",
        "night of champions",
        "crown jewel",
        "tribute to the troops",
        "greatest royal rumble",
        "king of the ring",
        "hell in a cell",
        "tables ladders & chairs",
        "tables, ladders & chairs",
        "tlc: tables",
        "fastlane",
        "wrestling backlash",
        "wrestling payback",
        "wrestling no mercy",
        "wrestling armageddon",
        "wrestling judgment day",
        "wrestling vengeance",
        "wrestling unforgiven",
        "wrestling over the limit",
        "wrestling breaking point",
        "wrestling bragging rights",
        "wrestling fatal 4-way",
        "wrestling capitol punishment",
        "wrestling roadblock",
        "wrestling battleground",

        "academy awards",
        "the oscars",
        "golden globe awards",
        "emmy awards",
        "grammy awards",
        "mtv movie",
        "mtv video music awards",
        "red carpet",
        "behind the scenes",
        "making of"
    ];

    if (blockedTitleParts.some((part) => title.includes(part))) {
        return false;
    }

    const blockedTvGenreIds = new Set([
        10763, // News
        10764, // Reality
        10767  // Talk
    ]);

    if (
        credit.media_type === "tv" &&
        genreIds.some((genreId) => blockedTvGenreIds.has(genreId))
    ) {
        return false;
    }

    if (Number(credit.vote_count || 0) < 5) {
        return false;
    }

    return true;
}

function getFilmographyYear(credit) {
    const date = credit.release_date || credit.first_air_date || "";
    const year = Number(String(date).slice(0, 4));
    return Number.isFinite(year) ? year : 0;
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
   EENMALIGE BULKFOTO'S SCORE 50–69
========================================================= */

function initialiseBulkScorePhotoButton() {
    const button = document.getElementById("bulk-score-photos-button");

    if (!button) return;

    button.addEventListener("click", downloadMissingScoreBandActorPhotos);
    updateBulkScorePhotoUi();
}

function updateBulkScorePhotoUi(message = "") {
    const button = document.getElementById("bulk-score-photos-button");
    const status = document.getElementById("bulk-score-photos-status");

    if (!button || !status) return;

    const ready = Boolean(
        state.database &&
        state.records.length &&
        state.actorsFolderHandle &&
        MOVIEMIND_API_KEY
    );

    button.disabled = !ready || bulkScorePhotoRunActive;

    if (message) {
        status.textContent = message;
    } else if (bulkScorePhotoRunActive) {
        status.textContent = "Bulkactie is bezig. Laat dit tabblad open tot de eindmelding verschijnt.";
    } else if (!state.database || !state.records.length) {
        status.textContent = "Koppel eerst de MovieMind-database.";
    } else if (!state.actorsFolderHandle) {
        status.textContent = "Koppel eerst game/images/actors.";
    } else if (!MOVIEMIND_API_KEY) {
        status.textContent = "TMDB_API_KEY ontbreekt.";
    } else {
        const saved = loadBulkPhotoProgress();
        if (saved && saved.completed === false && saved.nextIndex > 0) {
            status.textContent =
                "Vorige bulkactie stopte bij " +
                saved.nextIndex + "/" + saved.total +
                ". Klik om veilig te hervatten; reeds aanwezige foto's worden overgeslagen.";
        } else {
            status.textContent = "Klaar voor de eenmalige controle van score 50–69.";
        }
    }

    restoreBulkPhotoProgressUi();
}

function loadBulkPhotoProgress() {
    try {
        const raw = localStorage.getItem(BULK_PHOTO_PROGRESS_STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : null;

        return parsed && typeof parsed === "object" ? parsed : null;
    } catch (_) {
        return null;
    }
}

function saveBulkPhotoProgress(progress) {
    try {
        localStorage.setItem(
            BULK_PHOTO_PROGRESS_STORAGE_KEY,
            JSON.stringify(progress)
        );
    } catch (_) {
        /* Voortgang mag de bulkactie nooit blokkeren. */
    }
}

function clearBulkPhotoProgress() {
    try {
        localStorage.removeItem(BULK_PHOTO_PROGRESS_STORAGE_KEY);
    } catch (_) {}
}

function restoreBulkPhotoProgressUi() {
    const progress = loadBulkPhotoProgress();

    if (!progress) return;

    renderBulkPhotoProgress(progress);
}

function renderBulkPhotoProgress(progress) {
    const panel = document.getElementById("bulk-score-photos-progress");
    const counter = document.getElementById("bulk-score-photos-counter");
    const percent = document.getElementById("bulk-score-photos-percent");
    const bar = document.getElementById("bulk-score-photos-bar");
    const current = document.getElementById("bulk-score-photos-current");

    if (!panel || !counter || !percent || !bar || !current) return;

    panel.hidden = false;

    const total = Math.max(0, Number(progress.total || 0));
    const processed = Math.max(
        0,
        Math.min(total, Number(progress.nextIndex || 0))
    );
    const percentage = total
        ? Math.round(processed / total * 100)
        : 0;

    counter.textContent =
        processed.toLocaleString("nl-NL") +
        " / " +
        total.toLocaleString("nl-NL");

    percent.textContent = percentage + "%";
    bar.style.width = percentage + "%";

    if (progress.completed) {
        current.textContent = "Klaar.";
    } else if (progress.currentActor) {
        current.textContent =
            "Nu: " + progress.currentActor +
            (progress.currentScore !== undefined
                ? " · score " + progress.currentScore
                : "");
    } else {
        current.textContent = "Voorbereiden…";
    }

    setBulkPhotoStat("bulk-stat-downloaded", progress.downloaded);
    setBulkPhotoStat("bulk-stat-existing", progress.existing);
    setBulkPhotoStat("bulk-stat-no-photo", progress.noPhoto);
    setBulkPhotoStat("bulk-stat-failed", progress.failed);
}

function setBulkPhotoStat(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = Number(value || 0).toLocaleString("nl-NL");
}

function makeInitialBulkPhotoProgress(total) {
    return {
        total,
        nextIndex: 0,
        downloaded: 0,
        existing: 0,
        noPhoto: 0,
        failed: 0,
        currentActor: "",
        currentScore: null,
        completed: false,
        startedAt: Date.now()
    };
}

function buildStudioActorMetrics() {
    const actors = new Map();

    state.records.forEach((record) => {
        const names = getRecordActorNames(record);
        const uniqueNames = new Map();

        names.forEach((name) => {
            const key = normaliseStudioActorKey(name);
            if (key && !uniqueNames.has(key)) uniqueNames.set(key, name);
        });

        uniqueNames.forEach((name, key) => {
            if (!actors.has(key)) {
                actors.set(key, {
                    key,
                    name,
                    titleCount: 0,
                    genres: new Set(),
                    coActors: new Set(),
                    answerTotal: 0
                });
            }

            const actor = actors.get(key);
            actor.titleCount += 1;

            getRecordGenres(record).forEach((genre) => actor.genres.add(genre));

            uniqueNames.forEach((_coName, coKey) => {
                if (coKey !== key) actor.coActors.add(coKey);
            });

            actor.answerTotal += Math.max(0, uniqueNames.size - 1);
        });
    });

    return actors;
}

function getRecordActorNames(record) {
    const values = [];

    [record.actors, record.cast, record.cast_details].forEach((source) => {
        if (source === null || source === undefined) return;

        const list = Array.isArray(source) ? source : [source];

        list.forEach((value) => {
            const name = typeof value === "object" && value !== null
                ? value.name || value.actor || ""
                : value;

            if (String(name || "").trim()) values.push(String(name).trim());
        });
    });

    return values;
}

function getRecordGenres(record) {
    const source = record.genre || record.genres || [];
    const list = Array.isArray(source) ? source : [source];

    return list
        .map((value) => typeof value === "object" && value !== null
            ? value.name || ""
            : value)
        .map((value) => String(value || "").trim())
        .filter(Boolean);
}

function normaliseStudioActorKey(value) {
    return String(value || "")
        .trim()
        .toLocaleLowerCase("nl-NL");
}

function loadAnalyzerPopularityByNameForStudio() {
    const result = new Map();

    try {
        const cache = JSON.parse(
            localStorage.getItem(ANALYZER_POPULARITY_CACHE_KEY) || "{}"
        );

        Object.values(cache || {}).forEach((entry) => {
            if (!entry || !entry.name) return;

            result.set(
                normaliseStudioActorKey(entry.name),
                {
                    tmdbId: entry.tmdbId || null,
                    popularity: Number(entry.popularity || 0)
                }
            );
        });
    } catch (error) {
        console.warn("Analyzer-populariteit kon niet worden gelezen:", error);
    }

    return result;
}

function calculateStudioActorScores(actorMap) {
    const actors = Array.from(actorMap.values()).filter((actor) => actor.titleCount >= 2);
    const popularity = loadAnalyzerPopularityByNameForStudio();

    const rawRows = actors.map((actor) => {
        const rawScore =
            (actor.titleCount * 5) +
            (actor.genres.size * 2) +
            (Math.sqrt(actor.coActors.size) * 3) +
            Math.sqrt(actor.answerTotal);

        return { actor, rawScore };
    });

    const maxRaw = Math.max(1, ...rawRows.map((row) => row.rawScore));
    const maxTitles = Math.max(1, ...actors.map((actor) => actor.titleCount));
    const maxCoActors = Math.max(1, ...actors.map((actor) => actor.coActors.size));

    return rawRows.map(({ actor, rawScore }) => {
        const cached = popularity.get(actor.key) || {};
        const databaseComponent =
            Math.log1p(rawScore) / Math.log1p(maxRaw) * 50;
        const titleComponent =
            Math.log1p(actor.titleCount) / Math.log1p(maxTitles) * 25;
        const networkComponent =
            Math.log1p(actor.coActors.size) / Math.log1p(maxCoActors) * 15;
        const popularityComponent = cached.popularity > 0
            ? Math.min(
                10,
                Math.log1p(cached.popularity) / Math.log1p(250) * 10
            )
            : 0;

        return {
            ...actor,
            tmdbId: cached.tmdbId || null,
            fameScore: Math.max(
                0,
                Math.min(
                    100,
                    Math.round(
                        databaseComponent +
                        titleComponent +
                        networkComponent +
                        popularityComponent
                    )
                )
            )
        };
    });
}

async function actorPhotoExists(filename) {
    try {
        await state.actorsFolderHandle.getFileHandle(filename);
        return true;
    } catch (error) {
        if (error && error.name === "NotFoundError") return false;
        throw error;
    }
}

async function findTmdbPersonForBulkPhoto(actor) {
    if (actor.tmdbId) {
        try {
            const response = await fetch(
                "https://api.themoviedb.org/3/person/" +
                encodeURIComponent(actor.tmdbId) +
                "?api_key=" + encodeURIComponent(MOVIEMIND_API_KEY) +
                "&language=en-US"
            );

            if (response.ok) {
                const details = await response.json();
                if (details && details.profile_path) return details;
            }
        } catch (_) {
            // Zoek op naam als directe lookup mislukt.
        }
    }

    const response = await fetch(
        "https://api.themoviedb.org/3/search/person" +
        "?api_key=" + encodeURIComponent(MOVIEMIND_API_KEY) +
        "&language=en-US&include_adult=false&query=" +
        encodeURIComponent(actor.name)
    );

    if (!response.ok) {
        throw new Error("TMDB gaf foutcode " + response.status);
    }

    const payload = await response.json();
    const results = Array.isArray(payload.results) ? payload.results : [];

    const exact = results.find((item) =>
        normaliseStudioActorKey(item.name) === actor.key &&
        item.profile_path
    );

    return exact || results.find((item) => item.profile_path) || null;
}

async function saveBulkActorPhoto(actor, tmdbPerson) {
    const filename = createActorPhotoBaseName(actor.name) + ".jpg";

    if (await actorPhotoExists(filename)) {
        return { status: "existing", filename };
    }

    if (!tmdbPerson || !tmdbPerson.profile_path) {
        return { status: "no-photo", filename };
    }

    const response = await fetch(
        "https://image.tmdb.org/t/p/original" + tmdbPerson.profile_path
    );

    if (!response.ok) {
        throw new Error("afbeelding gaf foutcode " + response.status);
    }

    const blob = await response.blob();
    const fileHandle = await state.actorsFolderHandle.getFileHandle(
        filename,
        { create: true }
    );
    const writable = await fileHandle.createWritable();

    try {
        await writable.write(blob);
        await writable.close();
    } catch (error) {
        try { await writable.abort(); } catch (_) {}
        throw error;
    }

    return { status: "downloaded", filename };
}

async function downloadMissingScoreBandActorPhotos() {
    const button = document.getElementById("bulk-score-photos-button");

    if (bulkScorePhotoRunActive) return;

    if (!state.database || !state.records.length) {
        showToast("Koppel eerst de database.", "error");
        return;
    }

    if (!state.actorsFolderHandle) {
        showToast("Koppel eerst de acteursmap.", "error");
        return;
    }

    const permission = await ensurePermission(state.actorsFolderHandle, true);

    if (!permission) {
        showToast("Geen toestemming om in de acteursmap te schrijven.", "error");
        return;
    }

    const actors = calculateStudioActorScores(buildStudioActorMetrics())
        .filter((actor) =>
            actor.fameScore >= BULK_PHOTO_MIN_SCORE &&
            actor.fameScore <= BULK_PHOTO_MAX_SCORE
        )
        .sort((a, b) => {
            if (b.fameScore !== a.fameScore) return b.fameScore - a.fameScore;
            return a.name.localeCompare(b.name, "nl");
        });

    if (!actors.length) {
        showToast("Geen speelbare acteurs met score 50–69 gevonden.", "error");
        return;
    }

    let progress = loadBulkPhotoProgress();

    /*
    Hervatten is veilig omdat de acteurslijst deterministisch wordt gesorteerd.
    Is de oude voortgang niet meer passend bij de huidige lijst, dan beginnen
    we opnieuw. Bestaande bestanden worden sowieso overgeslagen.
    */
    if (
        !progress ||
        progress.completed ||
        Number(progress.total) !== actors.length ||
        Number(progress.nextIndex) < 0 ||
        Number(progress.nextIndex) > actors.length
    ) {
        progress = makeInitialBulkPhotoProgress(actors.length);
    }

    bulkScorePhotoRunActive = true;
    button.disabled = true;
    button.textContent = progress.nextIndex > 0
        ? "⏳ Bulkfoto's hervatten..."
        : "⏳ Foto's aanvullen...";

    saveBulkPhotoProgress(progress);
    renderBulkPhotoProgress(progress);

    const isResume = progress.nextIndex > 0;

    addActivityLog(
        (isResume ? "Bulkfoto's 50–69 hervat bij " : "Bulkfoto's 50–69 gestart voor ") +
        (isResume
            ? (progress.nextIndex + "/" + actors.length + ".")
            : (actors.length.toLocaleString("nl-NL") + " acteurs.")),
        "info"
    );

    updateBulkScorePhotoUi(
        isResume
            ? "Bulkactie hervat. Laat dit tabblad open."
            : "Bulkactie gestart. Laat dit tabblad open."
    );

    try {
        for (
            let index = Number(progress.nextIndex || 0);
            index < actors.length;
            index++
        ) {
            const actor = actors[index];

            progress.currentActor = actor.name;
            progress.currentScore = actor.fameScore;
            renderBulkPhotoProgress(progress);

            try {
                const filename =
                    createActorPhotoBaseName(actor.name) + ".jpg";

                if (await actorPhotoExists(filename)) {
                    progress.existing += 1;
                } else {
                    const tmdbPerson =
                        await findTmdbPersonForBulkPhoto(actor);

                    const result =
                        await saveBulkActorPhoto(actor, tmdbPerson);

                    if (result.status === "downloaded") {
                        progress.downloaded += 1;
                    } else if (result.status === "no-photo") {
                        progress.noPhoto += 1;
                    } else {
                        progress.existing += 1;
                    }
                }
            } catch (error) {
                progress.failed += 1;
                console.warn(
                    "Bulkfoto mislukt voor " + actor.name + ":",
                    error
                );
            }

            /*
            Cruciaal: pas NA iedere acteur schuiven we het hervatpunt op
            en schrijven we het naar localStorage. Bij een refresh gaat
            maximaal één acteur opnieuw, en die wordt dan als bestaand
            bestand herkend als hij al was opgeslagen.
            */
            progress.nextIndex = index + 1;
            saveBulkPhotoProgress(progress);
            renderBulkPhotoProgress(progress);

            await new Promise((resolve) =>
                window.setTimeout(resolve, 120)
            );
        }

        progress.completed = true;
        progress.currentActor = "";
        progress.currentScore = null;
        progress.finishedAt = Date.now();

        saveBulkPhotoProgress(progress);
        renderBulkPhotoProgress(progress);

        const summary =
            "Klaar · " + progress.downloaded + " gedownload · " +
            progress.existing + " bestonden al · " +
            progress.noPhoto + " zonder TMDB-foto · " +
            progress.failed + " mislukt.";

        addActivityLog(
            "Bulkfoto's 50–69: " + summary,
            progress.failed ? "warning" : "success"
        );

        showToast(
            summary,
            progress.failed ? "error" : "success"
        );

        updateBulkScorePhotoUi(summary);

        /*
        De eindstand blijft zichtbaar in het voortgangsblok. Bij een
        volgende klik start een volledig nieuwe controle, maar bestaande
        foto's worden nog steeds overgeslagen.
        */
    } finally {
        bulkScorePhotoRunActive = false;
        button.disabled = false;
        button.textContent =
            "📸 Ontbrekende foto's 50–69 aanvullen";
    }
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
        addActivityLog(
            "Acteursmap automatisch geladen: " +
                (handle.name || "acteursmap"),
            "success"
        );
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
    window.setTimeout(() => updateBulkScorePhotoUi(), 0);
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
        addActivityLog(
            "Database automatisch geladen: " +
                (handle.name || "MovieMind-database"),
            "success"
        );
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

    updateFilmographyBulkButton();
    updateFilmographyMissingFilter();

    if (state.selectedDetails && state.type === "person") {
        renderPersonFilmography(state.selectedDetails);
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
    window.setTimeout(() => updateBulkScorePhotoUi(), 0);
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
        addRecentItem(record);
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
    return createTitleRecordForType(
        details,
        state.type
    );
}

function createTitleRecordForType(details, mediaType) {
    const cast =
        details.credits &&
        Array.isArray(details.credits.cast)
            ? details.credits.cast.slice(0, 8)
            : [];
    const crew =
        details.credits &&
        Array.isArray(details.credits.crew)
            ? details.credits.crew
            : [];
    const directors =
        crew.filter(
            (person) => person.job === "Director"
        );
    const isTv = mediaType === "tv";

    return {
        id: details.id,
        title: isTv
            ? details.name || details.original_name
            : details.title || details.original_title,
        year: Number(
            (
                (
                    isTv
                        ? details.first_air_date
                        : details.release_date
                ) || ""
            ).slice(0, 4)
        ) || null,
        genre: (details.genres || [])
            .map((genre) => genre.name),
        director: directors
            .map((person) => person.name),
        actors: cast
            .map((person) => person.name)
            .filter(Boolean),
        characters: cast
            .map((person) => person.character || ""),
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
   ACTIVITEITENLOG + RECENT TOEGEVOEGD
========================================================= */

function initialiseActivityLog() {
    const clearButton =
        document.getElementById("clear-activity-log-button");

    if (clearButton) {
        clearButton.addEventListener("click", clearActivityLog);
    }

    renderActivityLog();
    renderRecentItems();
}

function addActivityLog(message, type = "info") {
    const entries = getStoredActivityLog();

    entries.unshift({
        message: String(message || "Onbekende activiteit"),
        type: ["success", "error", "warning", "info"].includes(type)
            ? type
            : "info",
        createdAt: new Date().toISOString()
    });

    try {
        localStorage.setItem(
            ACTIVITY_LOG_KEY,
            JSON.stringify(entries.slice(0, MAX_LOG_ITEMS))
        );
    } catch (error) {
        console.warn("Activiteitenlog kon niet worden opgeslagen:", error);
    }

    renderActivityLog();
}

function getStoredActivityLog() {
    try {
        const stored = JSON.parse(
            localStorage.getItem(ACTIVITY_LOG_KEY) || "[]"
        );

        return Array.isArray(stored) ? stored : [];
    } catch (error) {
        console.warn("Activiteitenlog kon niet worden gelezen:", error);
        return [];
    }
}

function renderActivityLog() {
    const log = document.getElementById("activity-log");

    if (!log) {
        return;
    }

    const entries = getStoredActivityLog().slice(0, MAX_LOG_ITEMS);
    log.innerHTML = "";

    if (!entries.length) {
        log.innerHTML =
            '<div class="activity-log-empty" id="activity-log-empty">' +
                "Nog geen activiteiten uitgevoerd." +
            "</div>";
        return;
    }

    entries.forEach((item) => {
        const entry = document.createElement("div");
        const icon = item.type === "success"
            ? "✓"
            : item.type === "error"
                ? "✖"
                : item.type === "warning"
                    ? "⚠"
                    : "•";

        entry.className = "activity-log-entry " + item.type;
        entry.textContent =
            formatLogTime(new Date(item.createdAt)) +
            " · " + icon + " " + item.message;
        log.appendChild(entry);
    });

    log.scrollTop = 0;
}

function clearActivityLog() {
    try {
        localStorage.removeItem(ACTIVITY_LOG_KEY);
    } catch (error) {
        console.warn("Activiteitenlog kon niet worden gewist:", error);
    }

    renderActivityLog();
}

function addRecentItem(record) {
    if (!record) {
        return;
    }

    const recentItems = getStoredRecentItems();
    const item = {
        title: String(record.title || "Onbekende titel"),
        year: record.year || null,
        mediaType: String(record.media_type || "movie"),
        addedAt: new Date().toISOString()
    };

    const deduplicated = recentItems.filter((existing) => {
        return !(
            existing.title === item.title &&
            existing.mediaType === item.mediaType
        );
    });

    deduplicated.unshift(item);

    try {
        localStorage.setItem(
            RECENT_ITEMS_KEY,
            JSON.stringify(deduplicated.slice(0, MAX_LOG_ITEMS))
        );
    } catch (error) {
        console.warn("Recent toegevoegd kon niet worden opgeslagen:", error);
    }

    renderRecentItems();
}

function getStoredRecentItems() {
    try {
        const stored = JSON.parse(
            localStorage.getItem(RECENT_ITEMS_KEY) || "[]"
        );

        return Array.isArray(stored) ? stored : [];
    } catch (error) {
        console.warn("Recent toegevoegd kon niet worden gelezen:", error);
        return [];
    }
}

function renderRecentItems() {
    const container = document.getElementById("recent-items-list");

    if (!container) {
        return;
    }

    const recentItems = getStoredRecentItems().slice(0, MAX_LOG_ITEMS);
    container.innerHTML = "";

    if (!recentItems.length) {
        container.innerHTML =
            '<div class="activity-log-empty" id="recent-items-empty">' +
                "Nog niets toegevoegd." +
            "</div>";
        return;
    }

    recentItems.forEach((item) => {
        const row = document.createElement("div");
        const time = document.createElement("span");
        const icon = document.createElement("span");
        const title = document.createElement("span");

        row.className = "recent-item-entry";
        time.className = "recent-item-time";
        icon.className = "recent-item-icon";
        title.className = "recent-item-title";

        time.textContent = formatLogTime(new Date(item.addedAt));
        icon.textContent = getRecentItemIcon(item.mediaType);
        title.textContent =
            item.title + (item.year ? " (" + item.year + ")" : "");

        row.appendChild(time);
        row.appendChild(icon);
        row.appendChild(title);
        container.appendChild(row);
    });
}

function getRecentItemIcon(mediaType) {
    if (mediaType === "tv") {
        return "📺";
    }

    if (mediaType === "person") {
        return "👤";
    }

    return "🎬";
}

function formatLogTime(date) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
        return "--:--:--";
    }

    return new Intl.DateTimeFormat("nl-NL", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
    }).format(date);
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
    state.selectedFilmographyCredits.clear();

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
    setFilmographyVisibility(false);

    const filmographyList = document.getElementById("filmography-list");
    const filmographyCount = document.getElementById("filmography-count");

    if (filmographyList) {
        filmographyList.innerHTML =
            '<div class="filmography-empty">Filmografie verschijnt hier.</div>';
    }

    if (filmographyCount) {
        filmographyCount.textContent = "0 titels";
    }

    const button = document.getElementById("add-selected-button");
    button.disabled = true;
    button.textContent = "＋ Toevoegen aan MovieMind";
}

let toastTimer = null;

function showToast(message, type = "") {
    const toast = document.getElementById("toast");
    window.clearTimeout(toastTimer);

    addActivityLog(
        message,
        type === "success"
            ? "success"
            : type === "error"
                ? "error"
                : "info"
    );

    toast.textContent = message;
    toast.className = "toast" + (type ? " is-" + type : "");
    toast.hidden = false;

    toastTimer = window.setTimeout(() => {
        toast.hidden = true;
    }, 5000);
}