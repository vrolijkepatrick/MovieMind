"use strict";

const MOVIEMIND_API_KEY =
    typeof TMDB_API_KEY !== "undefined" ? TMDB_API_KEY : "";

const ACTOR_ALIAS_CACHE_KEY = "moviemindAnalyzerActorAliases";
const ACTOR_POPULARITY_CACHE_KEY = "moviemindAnalyzerActorPopularity";

const state = {
    database: null,
    records: [],
    databaseHandle: null,
    analysis: {
        actors: new Map(),
        ranking: [],
        aliases: loadActorAliasCache(),
        popularity: loadActorPopularityCache(),
        filtered: [],
        page: 1,
        pageSize: 50,
        query: "",
        sort: "score-desc"
    }
};

const DB_NAME = "MovieMindAnalyzer";
const DB_VERSION = 1;
const HANDLE_STORE = "handles";
const DATABASE_HANDLE_KEY = "mainDatabase";

document.addEventListener("DOMContentLoaded", () => {
    initialiseButtons();
    initialiseAnalysisControls();
    restoreDatabaseConnection();
});

function initialiseButtons() {
    document
        .getElementById("connect-database-button")
        .addEventListener("click", connectDatabase);

    document
        .getElementById("reconnect-database-button")
        .addEventListener("click", requestSavedDatabasePermission);

    document
        .getElementById("analyze-actors-button")
        .addEventListener("click", analyzeActors);
}

async function connectDatabase() {
    if (!("showOpenFilePicker" in window)) {
        showToast(
            "Gebruik Chrome of Edge. Deze browser ondersteunt rechtstreeks openen niet.",
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

        if (!handle) return;

        const permission = await ensurePermission(handle, true);

        if (!permission) {
            throw new Error("Geen leestoestemming gekregen.");
        }

        await loadDatabaseFromHandle(handle);
        await saveHandle(handle);
        updateDatabaseConnectionUi("online");
        showToast("Database gekoppeld en onthouden.", "success");
    } catch (error) {
        if (error && error.name === "AbortError") return;

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
        const permission =
            await ensurePermission(state.databaseHandle, true);

        if (!permission) {
            throw new Error("Toestemming is niet verleend.");
        }

        await loadDatabaseFromHandle(state.databaseHandle);
        updateDatabaseConnectionUi("online");
        showToast("Database opnieuw verbonden.", "success");
    } catch (error) {
        console.error(error);
        showToast(
            "Opnieuw verbinden is mislukt: " +
                (error.message || "onbekende fout"),
            "error"
        );
    }
}

async function loadDatabaseFromHandle(handle) {
    const file = await handle.getFile();
    const text = await file.text();
    const database = JSON.parse(text);
    const records = extractRecords(database);

    if (!records.length) {
        throw new Error(
            "In deze database zijn geen films, series of acteurs gevonden."
        );
    }

    state.database = database;
    state.records = records;
    state.databaseHandle = handle;

    updateStatistics();
    updateDatabaseStatus(file);

    document.getElementById("analyze-actors-button").disabled = false;
}

function extractRecords(database) {
    if (Array.isArray(database)) return database;
    if (database && Array.isArray(database.films)) return database.films;
    if (database && Array.isArray(database.titles)) return database.titles;
    return [];
}

function updateStatistics() {
    let movies = 0;
    let series = 0;
    let persons = 0;
    const actors = new Set();

    state.records.forEach((record) => {
        const type = String(
            record.media_type ||
            record.type ||
            record.mediaType ||
            ""
        ).toLowerCase();

        if (["tv", "series", "serie", "show"].includes(type)) {
            series += 1;
        } else if (["person", "actor"].includes(type)) {
            persons += 1;
        } else {
            movies += 1;
        }

        collectUniqueActors(actors, record.actors);
        collectUniqueActors(actors, record.cast);
        collectUniqueActors(actors, record.cast_details);
    });

    setText("stat-total", state.records.length);
    setText("stat-movies", movies);
    setText("stat-series", series);
    setText("stat-persons", persons);
    setText("stat-actors", actors.size);
}

function collectUniqueActors(targetSet, values) {
    if (values === null || values === undefined) return;

    const list = Array.isArray(values) ? values : [values];

    list.forEach((value) => {
        const rawName =
            typeof value === "object" && value !== null
                ? value.name || value.actor || ""
                : value;

        const normalized =
            String(rawName || "")
                .trim()
                .toLocaleLowerCase("nl-NL");

        if (normalized) targetSet.add(normalized);
    });
}

function updateDatabaseStatus(file) {
    const date = new Intl.DateTimeFormat("nl-NL", {
        dateStyle: "short",
        timeStyle: "short"
    }).format(new Date(file.lastModified));

    setText(
        "database-status",
        file.name +
            " is gekoppeld · " +
            state.records.length.toLocaleString("nl-NL") +
            " records · gewijzigd " +
            date
    );
}

function updateDatabaseConnectionUi(stateName) {
    const chip = document.getElementById("database-chip");
    const reconnectButton =
        document.getElementById("reconnect-database-button");

    chip.dataset.state = stateName;

    if (stateName === "online") {
        setText("database-chip-title", "Database actief");
        setText(
            "database-chip-text",
            state.databaseHandle
                ? state.databaseHandle.name
                : "MovieMind-database"
        );
        reconnectButton.hidden = true;
    } else if (stateName === "permission") {
        setText("database-chip-title", "Toestemming nodig");
        setText(
            "database-chip-text",
            "Klik eenmaal om opnieuw te verbinden"
        );
        reconnectButton.hidden = false;
    } else {
        setText("database-chip-title", "Geen database gekoppeld");
        setText(
            "database-chip-text",
            "Koppel eerst de MovieMind-database"
        );
        reconnectButton.hidden = true;
    }
}

function analyzeActors() {
    if (!state.records.length) {
        showToast("Koppel eerst de MovieMind-database.", "error");
        return;
    }

    const button = document.getElementById("analyze-actors-button");
    button.disabled = true;
    button.textContent = "Analyseren...";

    try {
        const actors = buildActorAnalysis(state.records);
        const ranking = Array.from(actors.values())
            .map(finaliseActorStatistics)
            .sort((a, b) => {
                if (b.rawScore !== a.rawScore) {
                    return b.rawScore - a.rawScore;
                }

                if (b.titleCount !== a.titleCount) {
                    return b.titleCount - a.titleCount;
                }

                return a.name.localeCompare(b.name, "nl");
            });

        state.analysis.actors = actors;
        state.analysis.ranking = ranking;

        state.analysis.page = 1;
        applyAnalysisView();

        showToast(
            ranking.length.toLocaleString("nl-NL") +
                " acteurs geanalyseerd.",
            "success"
        );
    } catch (error) {
        console.error(error);
        showToast(
            "Analyse is mislukt: " +
                (error.message || "onbekende fout"),
            "error"
        );
    } finally {
        button.disabled = false;
        button.textContent = "🎭 Acteurs opnieuw analyseren";
    }
}

function buildActorAnalysis(records) {
    const actors = new Map();

    records.forEach((record, recordIndex) => {
        const type = String(
            record.media_type ||
            record.type ||
            record.mediaType ||
            ""
        ).toLowerCase();

        if (["person", "actor"].includes(type)) {
            return;
        }

        const cast = getRecordCast(record);

        if (!cast.length) {
            return;
        }

        const titleKey =
            String(record.id ?? record.tmdb_id ?? recordIndex);

        const genres = getRecordGenres(record);

        cast.forEach((actor) => {
            const actorKey = normaliseActorKey(actor.name);

            if (!actorKey) {
                return;
            }

            if (!actors.has(actorKey)) {
                actors.set(actorKey, {
                    id: actor.id || null,
                    name: actor.name,
                    titleIds: new Set(),
                    titles: new Map(),
                    genres: new Set(),
                    coActors: new Map(),
                    answerCount: 0
                });
            }

            const actorEntry = actors.get(actorKey);

            if (!actorEntry.id && actor.id) {
                actorEntry.id = actor.id;
            }

            actorEntry.titleIds.add(titleKey);
            actorEntry.titles.set(titleKey, {
                title:
                    record.title ||
                    record.name ||
                    record.original_title ||
                    record.original_name ||
                    "Titel onbekend",
                year: record.year || null,
                mediaType: type
            });

            genres.forEach((genre) => {
                actorEntry.genres.add(genre);
            });

            cast.forEach((coActor) => {
                const coActorKey = normaliseActorKey(coActor.name);

                if (coActorKey && coActorKey !== actorKey) {
                    actorEntry.coActors.set(
                        coActorKey,
                        coActor.name
                    );
                }
            });

            actorEntry.answerCount += Math.max(0, cast.length - 1);
        });
    });

    return actors;
}

function getRecordCast(record) {
    const source =
        Array.isArray(record.cast_details) && record.cast_details.length
            ? record.cast_details
            : Array.isArray(record.cast) && record.cast.length
                ? record.cast
                : Array.isArray(record.actors)
                    ? record.actors
                    : [];

    const seen = new Set();
    const cast = [];

    source.forEach((value) => {
        const actor =
            typeof value === "object" && value !== null
                ? {
                    id: value.id || value.tmdb_id || null,
                    name: value.name || value.actor || ""
                }
                : {
                    id: null,
                    name: String(value || "")
                };

        const key = normaliseActorKey(actor.name);

        if (!key || seen.has(key)) {
            return;
        }

        seen.add(key);
        cast.push({
            id: actor.id,
            name: String(actor.name).trim()
        });
    });

    return cast;
}

function getRecordGenres(record) {
    const values =
        record.genre ??
        record.genres ??
        [];

    const list = Array.isArray(values) ? values : [values];

    return list
        .map((value) => {
            if (typeof value === "object" && value !== null) {
                return value.name || value.genre || "";
            }

            return String(value || "");
        })
        .map((value) => value.trim())
        .filter(Boolean);
}

function normaliseActorKey(name) {
    return String(name || "")
        .trim()
        .toLocaleLowerCase("nl-NL");
}

function finaliseActorStatistics(actor) {
    const titleCount = actor.titleIds.size;
    const genreCount = actor.genres.size;
    const coActorCount = actor.coActors.size;
    const answerCount = actor.answerCount;

    const rawScore =
        (titleCount * 5) +
        (genreCount * 2) +
        Math.sqrt(coActorCount) * 3 +
        Math.sqrt(answerCount);

    return {
        id: actor.id,
        name: actor.name,
        titleCount,
        genreCount,
        coActorCount,
        answerCount,
        rawScore: Number(rawScore.toFixed(2)),
        tmdbPopularity: null,
        titles: Array.from(actor.titles.values())
            .sort((a, b) => {
                const yearDifference =
                    Number(b.year || 0) - Number(a.year || 0);

                return yearDifference ||
                    a.title.localeCompare(b.title, "nl");
            }),
        genres: Array.from(actor.genres)
            .sort((a, b) => a.localeCompare(b, "nl")),
        coActors: Array.from(actor.coActors.values())
            .sort((a, b) => a.localeCompare(b, "nl"))
    };
}

function initialiseAnalysisControls() {
    const searchInput =
        document.getElementById("analysis-search-input");
    const sortSelect =
        document.getElementById("analysis-sort-select");
    const previousButton =
        document.getElementById("analysis-prev-page");
    const nextButton =
        document.getElementById("analysis-next-page");
    const closeDetailButton =
        document.getElementById("actor-detail-close");

    if (searchInput) {
        searchInput.addEventListener("input", () => {
            state.analysis.query =
                searchInput.value.trim().toLocaleLowerCase("nl-NL");
            state.analysis.page = 1;
            applyAnalysisView();
        });
    }

    if (sortSelect) {
        sortSelect.addEventListener("change", () => {
            state.analysis.sort = sortSelect.value;
            state.analysis.page = 1;
            applyAnalysisView();
        });
    }

    if (previousButton) {
        previousButton.addEventListener("click", () => {
            if (state.analysis.page > 1) {
                state.analysis.page -= 1;
                renderActorAnalysisPage();
            }
        });
    }

    if (nextButton) {
        nextButton.addEventListener("click", () => {
            const totalPages = getAnalysisTotalPages();

            if (state.analysis.page < totalPages) {
                state.analysis.page += 1;
                renderActorAnalysisPage();
            }
        });
    }

    if (closeDetailButton) {
        closeDetailButton.addEventListener(
            "click",
            closeActorDetail
        );
    }
}

function applyAnalysisView() {
    ensureAnalysisResultsMarkup();

    const query = state.analysis.query;

    let filtered = state.analysis.ranking.filter((actor) => {
        if (!query) {
            return true;
        }

        const displayName =
            getActorDisplayName(actor).toLocaleLowerCase("nl-NL");
        const originalName =
            String(actor.name || "").toLocaleLowerCase("nl-NL");

        return (
            displayName.includes(query) ||
            originalName.includes(query)
        );
    });

    filtered = [...filtered].sort(getAnalysisSortFunction());

    state.analysis.filtered = filtered;

    const totalPages = getAnalysisTotalPages();

    if (state.analysis.page > totalPages) {
        state.analysis.page = totalPages;
    }

    renderActorAnalysisPage();
}

function getAnalysisSortFunction() {
    switch (state.analysis.sort) {
        case "score-asc":
            return (a, b) =>
                a.rawScore - b.rawScore ||
                a.name.localeCompare(b.name, "nl");

        case "titles-desc":
            return (a, b) =>
                b.titleCount - a.titleCount ||
                b.rawScore - a.rawScore;

        case "coactors-desc":
            return (a, b) =>
                b.coActorCount - a.coActorCount ||
                b.rawScore - a.rawScore;

        case "name-asc":
            return (a, b) =>
                getActorDisplayName(a).localeCompare(
                    getActorDisplayName(b),
                    "nl"
                );

        case "score-desc":
        default:
            return (a, b) =>
                b.rawScore - a.rawScore ||
                b.titleCount - a.titleCount ||
                a.name.localeCompare(b.name, "nl");
    }
}

function getAnalysisTotalPages() {
    return Math.max(
        1,
        Math.ceil(
            state.analysis.filtered.length /
            state.analysis.pageSize
        )
    );
}

function renderActorAnalysisPage() {
    ensureAnalysisResultsMarkup();

    const totalActors = state.analysis.ranking.length;
    const playableActors =
        state.analysis.ranking.filter(
            (actor) => actor.titleCount >= 2
        ).length;
    const totalTitles =
        state.analysis.ranking.reduce(
            (sum, actor) => sum + actor.titleCount,
            0
        );
    const averageTitles =
        totalActors ? totalTitles / totalActors : 0;

    const startIndex =
        (state.analysis.page - 1) *
        state.analysis.pageSize;
    const shown =
        state.analysis.filtered.slice(
            startIndex,
            startIndex + state.analysis.pageSize
        );

    setText("analysis-actor-count", totalActors);
    setText("analysis-playable-count", playableActors);
    setText(
        "analysis-average-titles",
        averageTitles.toLocaleString("nl-NL", {
            minimumFractionDigits: 1,
            maximumFractionDigits: 1
        })
    );
    setText("analysis-shown-count", state.analysis.filtered.length);

    const tableBody =
        document.getElementById("analysis-table-body");

    tableBody.innerHTML = "";

    shown.forEach((actor, index) => {
        const row = document.createElement("tr");

        appendCell(row, startIndex + index + 1);

        const nameCell = document.createElement("td");
        const nameButton = document.createElement("button");

        nameCell.classList.add("actor-name-cell");
        nameCell.dataset.actorId = actor.id || "";
        nameCell.dataset.actorName = actor.name || "";

        nameButton.type = "button";
        nameButton.className = "actor-name-button";
        nameButton.textContent = getActorDisplayName(actor);
        nameButton.addEventListener("click", () => {
            openActorDetail(actor);
        });

        if (getActorDisplayName(actor) !== actor.name) {
            nameButton.title = actor.name;
        }

        nameCell.appendChild(nameButton);
        row.appendChild(nameCell);

        appendCell(row, actor.titleCount);
        appendCell(row, actor.genreCount);
        appendCell(row, actor.coActorCount);
        appendCell(row, actor.answerCount);

        const popularityCell = appendCell(
            row,
            getActorPopularityDisplay(actor)
        );
        popularityCell.classList.add("actor-popularity-cell");
        popularityCell.dataset.actorPopularityKey =
            createActorPopularityCacheKey(actor);

        appendCell(
            row,
            actor.rawScore.toLocaleString("nl-NL", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            })
        );

        tableBody.appendChild(row);
    });

    updateAnalysisPagination();
    resolveVisibleActorAliases(shown);
    resolveVisibleActorPopularity(shown);

    const emptyState =
        document.getElementById("analysis-empty");
    const content =
        document.getElementById("analysis-content");

    if (emptyState) {
        emptyState.hidden = true;
    }

    if (content) {
        content.hidden = false;
    }
}

function updateAnalysisPagination() {
    const previousButton =
        document.getElementById("analysis-prev-page");
    const nextButton =
        document.getElementById("analysis-next-page");
    const pageInfo =
        document.getElementById("analysis-page-info");

    const totalPages = getAnalysisTotalPages();

    if (previousButton) {
        previousButton.disabled =
            state.analysis.page <= 1;
    }

    if (nextButton) {
        nextButton.disabled =
            state.analysis.page >= totalPages;
    }

    if (pageInfo) {
        pageInfo.textContent =
            "Pagina " +
            state.analysis.page +
            " van " +
            totalPages;
    }
}

function openActorDetail(actor) {
    const panel =
        document.getElementById("actor-detail-panel");

    if (!panel) {
        return;
    }

    const displayName = getActorDisplayName(actor);
    const originalName =
        document.getElementById("actor-detail-original-name");

    setText("actor-detail-name", displayName);
    setText("actor-detail-titles", actor.titleCount);
    setText("actor-detail-genres", actor.genreCount);
    setText("actor-detail-coactors", actor.coActorCount);
    setText("actor-detail-answers", actor.answerCount);
    setText(
        "actor-detail-popularity",
        getActorPopularityDisplay(actor)
    );
    setText(
        "actor-detail-score",
        actor.rawScore.toLocaleString("nl-NL", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        })
    );

    if (originalName) {
        originalName.hidden = displayName === actor.name;
        originalName.textContent =
            displayName === actor.name
                ? ""
                : "Oorspronkelijke naam: " + actor.name;
    }

    renderActorTitleList(actor.titles);
    renderActorGenreList(actor.genres);
    renderActorCoActorList(actor.coActors);

    panel.hidden = false;
    panel.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });
}

function closeActorDetail() {
    const panel =
        document.getElementById("actor-detail-panel");

    if (panel) {
        panel.hidden = true;
    }
}

function renderActorTitleList(titles) {
    const container =
        document.getElementById("actor-detail-title-list");

    container.innerHTML = "";

    if (!titles.length) {
        container.innerHTML =
            '<div class="actor-detail-item">Geen titels gevonden.</div>';
        return;
    }

    titles.forEach((item) => {
        const element = document.createElement("div");
        const typeLabel =
            ["tv", "series", "serie", "show"].includes(
                String(item.mediaType || "").toLowerCase()
            )
                ? "Serie"
                : "Film";

        element.className = "actor-detail-item";
        element.innerHTML =
            "<strong>" + escapeHtml(item.title) + "</strong>" +
            "<br><small>" +
            typeLabel +
            (item.year ? " · " + item.year : "") +
            "</small>";

        container.appendChild(element);
    });
}

function renderActorGenreList(genres) {
    const container =
        document.getElementById("actor-detail-genre-list");

    container.innerHTML = "";

    if (!genres.length) {
        container.textContent = "Geen genres gevonden.";
        return;
    }

    genres.forEach((genre) => {
        const tag = document.createElement("span");
        tag.className = "actor-tag";
        tag.textContent = genre;
        container.appendChild(tag);
    });
}

function renderActorCoActorList(coActors) {
    const container =
        document.getElementById("actor-detail-coactor-list");

    container.innerHTML = "";

    const examples = coActors.slice(0, 40);

    if (!examples.length) {
        container.innerHTML =
            '<div class="actor-detail-item">Geen medespelers gevonden.</div>';
        return;
    }

    examples.forEach((name) => {
        const element = document.createElement("div");
        element.className = "actor-detail-item";
        element.textContent = name;
        container.appendChild(element);
    });

    if (coActors.length > examples.length) {
        const remaining = document.createElement("div");
        remaining.className = "actor-detail-item";
        remaining.textContent =
            "En nog " +
            (coActors.length - examples.length).toLocaleString("nl-NL") +
            " andere medespelers.";
        container.appendChild(remaining);
    }
}

function escapeHtml(value) {
    return String(value || "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function ensureAnalysisResultsMarkup() {
    const results = document.getElementById("analysis-results");

    if (!results) {
        throw new Error(
            "Het resultatenblok ontbreekt in index.html."
        );
    }

    if (document.getElementById("analysis-table-body")) {
        return;
    }

    results.innerHTML =
        '<div id="analysis-content">' +
            '<div class="analysis-summary">' +
                '<div><span>Geanalyseerde acteurs</span><strong id="analysis-actor-count">0</strong></div>' +
                '<div><span>Acteurs met 2+ titels</span><strong id="analysis-playable-count">0</strong></div>' +
                '<div><span>Gemiddeld aantal titels</span><strong id="analysis-average-titles">0</strong></div>' +
                '<div><span>Getoonde resultaten</span><strong id="analysis-shown-count">0</strong></div>' +
            '</div>' +
            '<div class="analysis-controls">' +
                '<input id="analysis-search-input" type="search" placeholder="Zoek acteur..." autocomplete="off">' +
                '<select id="analysis-sort-select">' +
                    '<option value="score-desc">Score: hoog naar laag</option>' +
                    '<option value="score-asc">Score: laag naar hoog</option>' +
                    '<option value="titles-desc">Titels: meeste eerst</option>' +
                    '<option value="coactors-desc">Medespelers: meeste eerst</option>' +
                    '<option value="name-asc">Naam: A–Z</option>' +
                '</select>' +
            '</div>' +
            '<div class="analysis-table-wrap">' +
                '<table class="analysis-table">' +
                    '<thead><tr>' +
                        '<th>Rang</th>' +
                        '<th>Acteur</th>' +
                        '<th>Titels</th>' +
                        '<th>Genres</th>' +
                        '<th>Medespelers</th>' +
                        '<th>Mogelijke antwoorden</th>' +
                        '<th>TMDB-populariteit</th>' +
                        '<th>Ruwe score</th>' +
                    '</tr></thead>' +
                    '<tbody id="analysis-table-body"></tbody>' +
                '</table>' +
            '</div>' +
            '<div class="analysis-pagination">' +
                '<button id="analysis-prev-page" class="secondary-button" type="button">← Vorige</button>' +
                '<span id="analysis-page-info">Pagina 1 van 1</span>' +
                '<button id="analysis-next-page" class="secondary-button" type="button">Volgende →</button>' +
            '</div>' +
        '</div>';

    initialiseAnalysisControls();
}

function appendCell(row, value) {
    const cell = document.createElement("td");
    cell.textContent = value;
    row.appendChild(cell);
    return cell;
}

function containsMostlyNonLatinCharacters(value) {
    const letters = String(value || "").match(/\p{L}/gu) || [];

    if (!letters.length) {
        return false;
    }

    const latinLetters = letters.filter((character) =>
        /\p{Script=Latin}/u.test(character)
    );

    return latinLetters.length / letters.length < 0.5;
}

function getActorDisplayName(actor) {
    const cacheKey = createActorAliasCacheKey(actor);

    if (state.analysis.aliases[cacheKey]) {
        return state.analysis.aliases[cacheKey];
    }

    return actor.name;
}

async function resolveVisibleActorAliases(actors) {
    if (!MOVIEMIND_API_KEY) {
        console.warn(
            "Geen TMDB_API_KEY beschikbaar; alternatieve acteursnamen worden niet opgehaald."
        );
        return;
    }

    const candidates = actors.filter((actor) => {
        const cacheKey = createActorAliasCacheKey(actor);

        return (
            containsMostlyNonLatinCharacters(actor.name) &&
            !state.analysis.aliases[cacheKey]
        );
    });

    for (const actor of candidates) {
        try {
            const alias = await fetchLatinActorAlias(
                actor.id,
                actor.name
            );

            if (!alias) {
                continue;
            }

            const cacheKey = createActorAliasCacheKey(actor);
            state.analysis.aliases[cacheKey] = alias;
            saveActorAliasCache();

            document
                .querySelectorAll(".actor-name-cell")
                .forEach((cell) => {
                    const sameId =
                        actor.id &&
                        cell.dataset.actorId === String(actor.id);
                    const sameName =
                        cell.dataset.actorName === actor.name;

                    if (sameId || sameName) {
                        const button =
                            cell.querySelector(".actor-name-button");

                        if (button) {
                            button.textContent = alias;
                            button.title = actor.name;
                        } else {
                            cell.textContent = alias;
                            cell.title = actor.name;
                        }
                    }
                });
        } catch (error) {
            console.warn(
                "Alternatieve naam ophalen mislukt voor " +
                    actor.name + ":",
                error
            );
        }
    }
}

async function fetchLatinActorAlias(actorId, originalName) {
    let details = null;

    if (actorId) {
        details = await fetchTmdbPersonDetailsForAlias(actorId);
    }

    if (!details) {
        const searchResponse = await fetch(
            "https://api.themoviedb.org/3/search/person" +
                "?api_key=" +
                encodeURIComponent(MOVIEMIND_API_KEY) +
                "&language=en-US&include_adult=false&query=" +
                encodeURIComponent(originalName)
        );

        if (!searchResponse.ok) {
            throw new Error(
                "TMDB zoeken gaf foutcode " +
                    searchResponse.status
            );
        }

        const searchPayload = await searchResponse.json();
        const result = Array.isArray(searchPayload.results)
            ? searchPayload.results[0]
            : null;

        if (result && result.id) {
            details = await fetchTmdbPersonDetailsForAlias(
                result.id
            );
        }
    }

    if (!details) {
        return "";
    }

    const candidates = [
        details.name,
        ...(Array.isArray(details.also_known_as)
            ? details.also_known_as
            : [])
    ]
        .map((name) => String(name || "").trim())
        .filter(Boolean)
        .filter((name) =>
            !containsMostlyNonLatinCharacters(name)
        );

    if (!candidates.length) {
        return "";
    }

    const uniqueCandidates = [...new Set(candidates)];

    uniqueCandidates.sort((a, b) => {
        const aWords = a.split(/\s+/).length;
        const bWords = b.split(/\s+/).length;

        if (bWords !== aWords) {
            return bWords - aWords;
        }

        return a.length - b.length;
    });

    return uniqueCandidates[0] || "";
}

async function fetchTmdbPersonDetailsForAlias(actorId) {
    const response = await fetch(
        "https://api.themoviedb.org/3/person/" +
            encodeURIComponent(actorId) +
            "?api_key=" +
            encodeURIComponent(MOVIEMIND_API_KEY) +
            "&language=en-US"
    );

    if (!response.ok) {
        return null;
    }

    return response.json();
}

function createActorAliasCacheKey(actor) {
    if (actor.id) {
        return "id:" + String(actor.id);
    }

    return "name:" + normaliseActorKey(actor.name);
}

function getActorPopularityDisplay(actor) {
    const cacheKey = createActorPopularityCacheKey(actor);
    const cached = state.analysis.popularity[cacheKey];

    if (!cached || !Number.isFinite(Number(cached.popularity))) {
        return "Wordt opgehaald...";
    }

    return Number(cached.popularity).toLocaleString("nl-NL", {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1
    });
}

async function resolveVisibleActorPopularity(actors) {
    if (!MOVIEMIND_API_KEY) {
        return;
    }

    const candidates = actors.filter((actor) => {
        const cacheKey = createActorPopularityCacheKey(actor);
        return !state.analysis.popularity[cacheKey];
    });

    for (const actor of candidates) {
        try {
            const details = await fetchActorTmdbDetails(
                actor.id,
                actor.name
            );

            if (!details) {
                continue;
            }

            const cacheKey = createActorPopularityCacheKey(actor);

            state.analysis.popularity[cacheKey] = {
                tmdbId: details.id || actor.id || null,
                popularity: Number(details.popularity || 0),
                name: details.name || actor.name,
                fetchedAt: new Date().toISOString()
            };

            saveActorPopularityCache();
            updateActorPopularityUi(actor);
        } catch (error) {
            console.warn(
                "TMDB-populariteit ophalen mislukt voor " +
                    actor.name + ":",
                error
            );
        }
    }
}

async function fetchActorTmdbDetails(actorId, actorName) {
    if (actorId) {
        const direct = await fetchTmdbPersonDetailsForAlias(actorId);

        if (direct) {
            return direct;
        }
    }

    const response = await fetch(
        "https://api.themoviedb.org/3/search/person" +
            "?api_key=" +
            encodeURIComponent(MOVIEMIND_API_KEY) +
            "&language=en-US&include_adult=false&query=" +
            encodeURIComponent(actorName)
    );

    if (!response.ok) {
        return null;
    }

    const payload = await response.json();
    const results = Array.isArray(payload.results)
        ? payload.results
        : [];

    if (!results.length) {
        return null;
    }

    const exact = results.find((item) =>
        normaliseActorKey(item.name) ===
        normaliseActorKey(actorName)
    );

    return exact || results[0];
}

function createActorPopularityCacheKey(actor) {
    if (actor.id) {
        return "id:" + String(actor.id);
    }

    return "name:" + normaliseActorKey(actor.name);
}

function updateActorPopularityUi(actor) {
    const cacheKey = createActorPopularityCacheKey(actor);
    const display = getActorPopularityDisplay(actor);

    document
        .querySelectorAll(
            '[data-actor-popularity-key="' +
            CSS.escape(cacheKey) +
            '"]'
        )
        .forEach((cell) => {
            cell.textContent = display;
        });

    const detailPanel =
        document.getElementById("actor-detail-panel");
    const detailName =
        document.getElementById("actor-detail-name");

    if (
        detailPanel &&
        !detailPanel.hidden &&
        detailName &&
        detailName.textContent === getActorDisplayName(actor)
    ) {
        setText("actor-detail-popularity", display);
    }
}

function loadActorPopularityCache() {
    try {
        const value =
            localStorage.getItem(ACTOR_POPULARITY_CACHE_KEY);
        const parsed = value ? JSON.parse(value) : {};

        return parsed && typeof parsed === "object"
            ? parsed
            : {};
    } catch (_) {
        return {};
    }
}

function saveActorPopularityCache() {
    localStorage.setItem(
        ACTOR_POPULARITY_CACHE_KEY,
        JSON.stringify(state.analysis.popularity)
    );
}

function loadActorAliasCache() {
    try {
        const value = localStorage.getItem(ACTOR_ALIAS_CACHE_KEY);
        const parsed = value ? JSON.parse(value) : {};

        return parsed && typeof parsed === "object"
            ? parsed
            : {};
    } catch (_) {
        return {};
    }
}

function saveActorAliasCache() {
    localStorage.setItem(
        ACTOR_ALIAS_CACHE_KEY,
        JSON.stringify(state.analysis.aliases)
    );
}

async function ensurePermission(handle, requestPermission) {
    const options = { mode: "read" };

    if (!handle.queryPermission) return true;

    let permission = await handle.queryPermission(options);

    if (permission === "granted") return true;

    if (requestPermission && handle.requestPermission) {
        permission = await handle.requestPermission(options);
        return permission === "granted";
    }

    return false;
}

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

async function saveHandle(handle) {
    const database = await openSettingsDatabase();

    return new Promise((resolve, reject) => {
        const transaction =
            database.transaction(HANDLE_STORE, "readwrite");

        transaction
            .objectStore(HANDLE_STORE)
            .put(handle, DATABASE_HANDLE_KEY);

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

async function getSavedHandle() {
    const database = await openSettingsDatabase();

    return new Promise((resolve, reject) => {
        const transaction =
            database.transaction(HANDLE_STORE, "readonly");

        const request =
            transaction
                .objectStore(HANDLE_STORE)
                .get(DATABASE_HANDLE_KEY);

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

function setText(id, value) {
    const element = document.getElementById(id);

    if (!element) return;

    element.textContent =
        typeof value === "number"
            ? value.toLocaleString("nl-NL")
            : value;
}

let toastTimer = null;

function showToast(message, type = "") {
    const toast = document.getElementById("toast");

    window.clearTimeout(toastTimer);

    toast.textContent = message;
    toast.className =
        "toast" + (type ? " is-" + type : "");
    toast.hidden = false;

    toastTimer = window.setTimeout(() => {
        toast.hidden = true;
    }, 4500);
}