const movieTitleInput = document.getElementById("movieTitle");
const actorNameInput = document.getElementById("actorName");

const searchBtn = document.getElementById("searchBtn");
const actorSearchBtn = document.getElementById("actorSearchBtn");

const movieTabBtn = document.getElementById("movieTabBtn");
const actorTabBtn = document.getElementById("actorTabBtn");

const movieSearchView = document.getElementById("movieSearchView");
const actorSearchView = document.getElementById("actorSearchView");

const movieSuggestions = document.getElementById("movieSuggestions");
const actorSuggestions = document.getElementById("actorSuggestions");

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

const loadDatabaseInput = document.getElementById("loadDatabaseInput");
const exportBtn = document.getElementById("exportBtn");
const databaseCount = document.getElementById("databaseCount");
const lastAddedMovieElement = document.getElementById("lastAddedMovie");
const recentMoviesList = document.getElementById("recentMoviesList");

const choosePhotoFolderBtn = document.getElementById("choosePhotoFolderBtn");
const testActorPhotoBtn = document.getElementById("saveActorPhotoUnderPreviewBtn");
const autoDownloadActorPhotosCheckbox =
    document.getElementById("autoDownloadActorPhotosCheckbox");
const photoStatus = document.getElementById("photoStatus");

const fillMissingActorPhotosBtn =
    document.getElementById("fillMissingActorPhotosBtn");
const photoBulkProgress =
    document.getElementById("photoBulkProgress");
const photoProgressTitle =
    document.getElementById("photoProgressTitle");
const photoProgressCounter =
    document.getElementById("photoProgressCounter");
const photoProgressFill =
    document.getElementById("photoProgressFill");
const photoCurrentActor =
    document.getElementById("photoCurrentActor");
const photoDownloadedCount =
    document.getElementById("photoDownloadedCount");
const photoExistingCount =
    document.getElementById("photoExistingCount");
const photoMissingCount =
    document.getElementById("photoMissingCount");
const photoFailedCount =
    document.getElementById("photoFailedCount");
const photoReviewCount =
    document.getElementById("photoReviewCount");
const photoReviewPanel =
    document.getElementById("photoReviewPanel");
const photoReviewList =
    document.getElementById("photoReviewList");
const downloadPhotoReviewBtn =
    document.getElementById("downloadPhotoReviewBtn");

const actorPreviewCard =
    document.getElementById("sidebarActorPhotoCard");
const actorPreviewImage =
    document.getElementById("sidebarActorPhoto");
const actorPreviewPlaceholder =
    document.getElementById("sidebarActorPhotoPlaceholder");
const actorPreviewName =
    document.getElementById("sidebarActorPhotoName");
const actorPreviewMeta =
    document.getElementById("sidebarActorPhotoState");
const actorPhotoChoices =
    document.getElementById("actorPhotoChoices");
const actorPhotoChoicesStatus =
    document.getElementById("actorPhotoChoicesStatus");
const actorPhotoAlreadyExistsMessage =
    document.getElementById("actorPhotoAlreadyExistsMessage");

let importedMovies = [];
let lastAddedMovie = null;
let loadedDatabaseFileName = "moviemind_database.json";

let currentResults = [];
let selectedActor = null;
let selectedActorMovies = [];

let actorPhotoDirectoryHandle = null;
let actorPreviewObjectUrl = null;
let bulkPhotoScanRunning = false;
let lastActorPhotoSaveError = "";
let selectedActorPhotoCandidate = null;
let selectedActorHasLocalPhoto = false;
let actorPhotoChoiceRequestId = 0;
let bulkPhotoReviewItems = [];
let bulkPhotoProblemItems = [];

const availableMovies = new Map();

const PHOTO_DB_NAME = "MovieMindImporter";
const PHOTO_STORE_NAME = "settings";
const PHOTO_HANDLE_KEY = "actorPhotoDirectoryHandle";
const ACTIVE_DATABASE_KEY = "activeMovieMindDatabase";
const ACTIVE_SEARCH_TAB_KEY = "activeMovieMindSearchTab";


/* =========================================================
   TABBLADEN
========================================================= */

movieTabBtn.addEventListener("click", function () {
    showSearchTab("movie");
});

actorTabBtn.addEventListener("click", function () {
    showSearchTab("actor");
});

function showSearchTab(tab) {
    const safeTab = tab === "actor" ? "actor" : "movie";
    const movieActive = safeTab === "movie";

    movieTabBtn.classList.toggle("active", movieActive);
    actorTabBtn.classList.toggle("active", !movieActive);

    movieSearchView.classList.toggle("hidden", !movieActive);
    actorSearchView.classList.toggle("hidden", movieActive);

    hideSuggestions();

    try {
        localStorage.setItem(
            ACTIVE_SEARCH_TAB_KEY,
            safeTab
        );
    } catch (error) {
        console.warn(
            "Zoektab onthouden mislukt:",
            error
        );
    }

    /*
    Geen automatische focus: daardoor springt de pagina
    niet naar een andere positie wanneer van tab wordt gewisseld.
    */
}


/* =========================================================
   DATABASE LADEN EN EXPORTEREN
========================================================= */

loadDatabaseInput.addEventListener("change", loadDatabase);
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

            if (!parsed || !Array.isArray(parsed.films)) {
                throw new Error("Geen geldige MovieMind-database.");
            }

            importedMovies = deduplicateMovies(parsed.films);
            loadedDatabaseFileName = file.name || "moviemind_database.json";
            lastAddedMovie = null;

            refreshDatabasePanel();
            refreshVisibleMovieCards();
            saveActiveDatabase();

            alert(
                importedMovies.length +
                " unieke films uit de database geladen."
            );

        } catch (error) {
            console.error(error);
            alert("Het gekozen JSON-bestand kon niet worden geladen.");
        } finally {
            loadDatabaseInput.value = "";
        }
    };

    reader.readAsText(file);
}

function exportDatabase() {
    if (importedMovies.length === 0) {
        alert("Laad eerst een database.");
        return;
    }

    const data = {
        films: importedMovies
    };

    const blob = new Blob(
        [JSON.stringify(data, null, 2)],
        {
            type: "application/json"
        }
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

    alert(
        importedMovies.length +
        " films geëxporteerd naar " +
        loadedDatabaseFileName +
        "."
    );
}

function deduplicateMovies(movies) {
    const unique = new Map();

    movies.forEach(function (movie) {
        if (
            movie &&
            movie.id !== undefined &&
            movie.title
        ) {
            unique.set(Number(movie.id), movie);
        }
    });

    return Array.from(unique.values());
}

function refreshDatabasePanel() {
    databaseCount.textContent = String(importedMovies.length);
    updatePhotoTestButton();

    exportBtn.disabled = importedMovies.length === 0;

    lastAddedMovieElement.textContent =
        lastAddedMovie
            ? (
                lastAddedMovie.title +
                " (" +
                (lastAddedMovie.year || "?") +
                ")"
            )
            : (
                importedMovies.length > 0
                    ? "Database geladen"
                    : "Nog niets toegevoegd"
            );

    recentMoviesList.innerHTML = "";

    if (importedMovies.length === 0) {
        const item = document.createElement("li");
        item.className = "muted-item";
        item.textContent = "Nog geen database geladen.";
        recentMoviesList.appendChild(item);
        return;
    }

    importedMovies
        .slice(-25)
        .reverse()
        .forEach(function (movie) {
            const item = document.createElement("li");

            item.textContent =
                movie.title +
                " (" +
                (movie.year || "?") +
                ")";

            if (
                lastAddedMovie &&
                Number(movie.id) === Number(lastAddedMovie.id)
            ) {
                item.style.fontWeight = "800";
                item.textContent += " ← laatst toegevoegd";
            }

            recentMoviesList.appendChild(item);
        });
}


/* =========================================================
   FILM ZOEKEN
========================================================= */

searchBtn.addEventListener("click", searchMovie);

movieTitleInput.addEventListener("keydown", function (event) {
    if (event.key === "Enter") {
        event.preventDefault();
        searchMovie();
    }
});

async function searchMovie() {
    const query = movieTitleInput.value.trim();

    if (!query) {
        alert("Typ eerst een filmnaam.");
        return;
    }

    searchBtn.disabled = true;
    searchBtn.textContent = "Zoeken...";

    try {
        const url =
            "https://api.themoviedb.org/3/search/movie" +
            "?api_key=" + TMDB_API_KEY +
            "&language=en-US" +
            "&include_adult=false" +
            "&query=" + encodeURIComponent(query);

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error("Film zoeken mislukt.");
        }

        const data = await response.json();

        const movies = (data.results || [])
            .filter(function (movie) {
                return movie.id && movie.title;
            })
            .map(function (movie) {
                return {
                    id: movie.id,
                    title: movie.title,
                    original_title: movie.original_title || movie.title,
                    year: movie.release_date
                        ? Number(movie.release_date.slice(0, 4))
                        : null,
                    release_date: movie.release_date || "",
                    popularity: movie.popularity || 0,
                    fullDetails: false
                };
            })
            .sort(function (a, b) {
                return b.popularity - a.popularity;
            })
            .slice(0, 20);

        currentResults = movies;
        selectedActor = null;
        selectedActorMovies = [];

        movies.forEach(function (movie) {
            availableMovies.set(Number(movie.id), movie);
        });

        renderMovieResults(
            "Zoekresultaten voor “" + query + "”",
            movies
        );

    } catch (error) {
        console.error(error);
        alert("Er ging iets mis bij het zoeken naar films.");
    } finally {
        searchBtn.disabled = false;
        searchBtn.textContent = "Film zoeken";
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

        const creditsUrl =
            "https://api.themoviedb.org/3/person/" +
            actor.id +
            "/movie_credits" +
            "?api_key=" + TMDB_API_KEY +
            "&language=nl-NL";

        const creditsResponse = await fetch(creditsUrl);

        if (!creditsResponse.ok) {
            throw new Error("Filmografie ophalen mislukt.");
        }

        const creditsData = await creditsResponse.json();
        const unique = new Map();

        (creditsData.cast || [])
            .filter(isAllowedActorCredit)
            .forEach(function (movie) {
                if (!unique.has(Number(movie.id))) {
                    unique.set(Number(movie.id), {
                        id: movie.id,
                        title: movie.title,
                        year: movie.release_date
                            ? Number(movie.release_date.slice(0, 4))
                            : null,
                        release_date: movie.release_date || "",
                        character: movie.character || "",
                        popularity: movie.popularity || 0,
                        fullDetails: false
                    });
                }
            });

        const movies = Array.from(unique.values())
            .sort(function (a, b) {
                return (b.year || 0) - (a.year || 0);
            });

        selectedActor = actor;
        selectedActorMovies = movies;
        currentResults = movies;

        actorNameInput.value = actor.name;

        await updateActorPreview(actor, movies.length);
        await loadActorPhotoChoices(actor);

        movies.forEach(function (movie) {
            availableMovies.set(Number(movie.id), movie);
        });

        updatePhotoTestButton();

        renderMovieResults(
            "Films van " + actor.name,
            movies
        );

    } catch (error) {
        console.error(error);
        alert("Er ging iets mis bij het zoeken naar de acteur.");
    } finally {
        actorSearchBtn.disabled = false;
        actorSearchBtn.textContent = "Acteur zoeken";
    }
}

async function findActorByName(name) {
    const url =
        "https://api.themoviedb.org/3/search/person" +
        "?api_key=" + TMDB_API_KEY +
        "&language=en-US" +
        "&include_adult=false" +
        "&query=" + encodeURIComponent(name);

    const response = await fetch(url);

    if (!response.ok) {
        throw new Error("Acteur zoeken mislukt.");
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

    if (actors.length === 0) {
        return null;
    }

    return {
        id: actors[0].id,
        name: actors[0].name,
        profile_path: actors[0].profile_path || null
    };
}


/* =========================================================
   RESULTATEN EN SELECTIE
========================================================= */

selectAllBtn.addEventListener("click", function () {
    document
        .querySelectorAll(".movie-checkbox:not(:disabled)")
        .forEach(function (checkbox) {
            if (
                checkbox.closest(".movie-card").style.display !== "none"
            ) {
                checkbox.checked = true;
            }
        });

    updateSelectionState();
});

clearSelectionBtn.addEventListener("click", function () {
    document
        .querySelectorAll(".movie-checkbox")
        .forEach(function (checkbox) {
            checkbox.checked = false;
        });

    updateSelectionState();
});

hideImportedCheckbox.addEventListener(
    "change",
    refreshVisibleMovieCards
);

function renderMovieResults(title, movies) {
    resultsTitle.textContent = title;
    resultsSubtitle.textContent =
        movies.length +
        (movies.length === 1 ? " film gevonden" : " films gevonden");

    resultsList.innerHTML = "";

    if (movies.length === 0) {
        resultsList.innerHTML =
            '<div class="empty-state">' +
            '<span>🎞️</span>' +
            '<strong>Geen films gevonden</strong>' +
            '</div>';

        selectionToolbar.classList.add("hidden");
        updateSelectionState();
        return;
    }

    movies.forEach(function (movie) {
        resultsList.appendChild(createMovieCard(movie));
    });

    selectionToolbar.classList.remove("hidden");
    refreshVisibleMovieCards();
    updateSelectionState();
}

function createMovieCard(movie) {
    const card = document.createElement("div");
    card.className = "movie-card";
    card.dataset.movieId = String(movie.id);

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "movie-checkbox";
    checkbox.dataset.movieId = String(movie.id);

    checkbox.addEventListener("change", updateSelectionState);

    const info = document.createElement("div");
    info.className = "movie-info";

    const heading = document.createElement("h3");
    heading.textContent =
        movie.title +
        " (" +
        (movie.year || "?") +
        ")";

    info.appendChild(heading);

    if (movie.character) {
        const role = document.createElement("p");
        role.textContent = "Rol: " + movie.character;
        info.appendChild(role);
    }

    const imported = isMovieImported(movie.id);

    if (imported) {
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

function refreshVisibleMovieCards() {
    const hideImported = hideImportedCheckbox.checked;

    document
        .querySelectorAll(".movie-card")
        .forEach(function (card) {
            const movieId = Number(card.dataset.movieId);
            const imported = isMovieImported(movieId);
            const checkbox = card.querySelector(".movie-checkbox");

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
    const selected = Array.from(
        document.querySelectorAll(
            ".movie-checkbox:checked:not(:disabled)"
        )
    );

    const amount = selected.length;

    const text =
        amount === 1
            ? "1 film geselecteerd"
            : amount + " films geselecteerd";

    selectionCount.textContent = text;
    batchSelectionCount.textContent = text;

    addSelectedBtn.disabled = amount === 0;
    batchBar.classList.toggle("hidden", amount === 0);
}

function isMovieImported(movieId) {
    return importedMovies.some(function (movie) {
        return Number(movie.id) === Number(movieId);
    });
}


/* =========================================================
   FILMS TOEVOEGEN
========================================================= */

addSelectedBtn.addEventListener("click", addSelectedMovies);

async function addSelectedMovies() {
    const selectedCheckboxes = Array.from(
        document.querySelectorAll(
            ".movie-checkbox:checked:not(:disabled)"
        )
    );

    if (selectedCheckboxes.length === 0) {
        return;
    }

    const originalAddButtonText = addSelectedBtn.textContent;
    const automaticPhotosEnabled =
        autoDownloadActorPhotosCheckbox.checked &&
        Boolean(actorPhotoDirectoryHandle);

    setImporterBusy(true);
    addSelectedBtn.textContent = "⏳ Films verwerken...";

    let added = 0;
    let skipped = 0;
    let failed = 0;

    let photosDownloaded = 0;
    let photosExisting = 0;
    let photosMissing = 0;
    let photosFailed = 0;

    const processedPhotoNames = new Set();

    try {
        for (
            let index = 0;
            index < selectedCheckboxes.length;
            index++
        ) {
            const movieId =
                Number(selectedCheckboxes[index].dataset.movieId);

            const knownMovie = availableMovies.get(movieId);
            const movieLabel = knownMovie && knownMovie.title
                ? knownMovie.title
                : "film ophalen";

            batchProgressText.textContent =
                (index + 1) +
                " van " +
                selectedCheckboxes.length +
                " · " +
                movieLabel;

            if (isMovieImported(movieId)) {
                skipped++;
                continue;
            }

            try {
                let movie = knownMovie;

                if (!movie || movie.fullDetails !== true) {
                    movie = await getMovieDetails(movieId);
                    availableMovies.set(movieId, movie);
                }

                batchProgressText.textContent =
                    (index + 1) +
                    " van " +
                    selectedCheckboxes.length +
                    " · " +
                    movie.title +
                    " toevoegen...";

                const photoCandidates =
                    Array.isArray(movie.actorPhotoCandidates)
                        ? movie.actorPhotoCandidates
                        : [];

                const cleanMovie = {
                    id: movie.id,
                    title: movie.title,
                    year: movie.year,
                    genre: movie.genre,
                    director: movie.director,
                    actors: movie.actors,
                    characters: movie.characters,
                    fullDetails: true
                };

                importedMovies.push(cleanMovie);
                lastAddedMovie = cleanMovie;
                added++;

                refreshDatabasePanel();
                refreshVisibleMovieCards();

                if (automaticPhotosEnabled) {
                    for (const candidate of photoCandidates) {
                        const filename =
                            createActorPhotoFilename(candidate.name);

                        if (processedPhotoNames.has(filename)) {
                            continue;
                        }

                        processedPhotoNames.add(filename);

                        const result =
                            await saveActorPhotoCandidate(candidate);

                        if (result === "downloaded") {
                            photosDownloaded++;
                        } else if (result === "existing") {
                            photosExisting++;
                        } else if (result === "missing") {
                            photosMissing++;
                        } else {
                            photosFailed++;
                        }
                    }
                }

            } catch (error) {
                console.error(
                    "Film toevoegen mislukt:",
                    movieId,
                    error
                );

                failed++;
            }
        }

        batchProgressText.textContent =
            "Database veilig opslaan...";

        await saveActiveDatabase();

        refreshDatabasePanel();
        refreshVisibleMovieCards();

        batchProgressText.textContent =
            added === 1
                ? "1 film toegevoegd."
                : added + " films toegevoegd.";

        let message =
            "Klaar!\n\n" +
            "Toegevoegd: " + added + "\n" +
            "Al aanwezig: " + skipped + "\n" +
            "Mislukt: " + failed;

        if (automaticPhotosEnabled) {
            message +=
                "\n\nFoto’s opgeslagen: " + photosDownloaded +
                "\nFoto’s bestonden al: " + photosExisting +
                "\nGeen TMDB-foto: " + photosMissing +
                "\nFoto’s mislukt: " + photosFailed;
        }

        alert(message);

    } catch (error) {
        console.error("Batch opslaan mislukt:", error);

        batchProgressText.textContent =
            "Er ging iets mis tijdens het opslaan.";

        alert(
            "De films zijn verwerkt, maar de lokale " +
            "databasebeveiliging kon niet worden bijgewerkt. " +
            "Exporteer de database voor de zekerheid meteen."
        );

    } finally {
        addSelectedBtn.textContent = originalAddButtonText;
        setImporterBusy(false);
        updateSelectionState();
    }
}

function setImporterBusy(isBusy) {
    searchBtn.disabled = isBusy;
    actorSearchBtn.disabled = isBusy;
    movieTabBtn.disabled = isBusy;
    actorTabBtn.disabled = isBusy;
    selectAllBtn.disabled = isBusy;
    clearSelectionBtn.disabled = isBusy;
    loadDatabaseInput.disabled = isBusy;
    choosePhotoFolderBtn.disabled = isBusy;
    testActorPhotoBtn.disabled =
        isBusy || !(selectedActor && actorPhotoDirectoryHandle);

    fillMissingActorPhotosBtn.disabled =
        isBusy ||
        bulkPhotoScanRunning ||
        !actorPhotoDirectoryHandle ||
        importedMovies.length === 0;

    exportBtn.disabled =
        isBusy || importedMovies.length === 0;

    addSelectedBtn.disabled = isBusy;
}

async function getMovieDetails(movieId) {
    const url =
        "https://api.themoviedb.org/3/movie/" +
        movieId +
        "?api_key=" + TMDB_API_KEY +
        "&language=nl-NL" +
        "&append_to_response=credits";

    const response = await fetch(url);

    if (!response.ok) {
        throw new Error("Filmdetails ophalen mislukt.");
    }

    const details = await response.json();
    const credits = details.credits || {
        cast: [],
        crew: []
    };

    const mainCast = (credits.cast || []).slice(0, 8);

    return {
        id: details.id,
        title: details.title,
        year: details.release_date
            ? Number(details.release_date.slice(0, 4))
            : null,
        genre: (details.genres || []).map(function (genre) {
            return genre.name;
        }),
        director: (credits.crew || [])
            .filter(function (person) {
                return person.job === "Director";
            })
            .map(function (person) {
                return person.name;
            }),
        actors: mainCast
            .map(function (person) {
                return person.name;
            })
            .filter(Boolean),
        characters: mainCast
            .map(function (person) {
                return person.character;
            })
            .filter(Boolean),
        actorPhotoCandidates: mainCast.map(function (person) {
            return {
                id: person.id,
                name: person.name,
                profile_path: person.profile_path || null
            };
        }),
        fullDetails: true
    };
}


/* =========================================================
   FOTO’S
========================================================= */

choosePhotoFolderBtn.addEventListener(
    "click",
    choosePhotoFolder
);

testActorPhotoBtn.addEventListener(
    "click",
    saveSelectedActorPhoto
);

fillMissingActorPhotosBtn.addEventListener(
    "click",
    fillMissingActorPhotos
);

downloadPhotoReviewBtn.addEventListener(
    "click",
    downloadPhotoReviewList
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
            const permission =
                await requestDirectoryPermission(handle);

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
            "Acteursfotomap actief: " + handle.name,
            "success"
        );

        updatePhotoTestButton();

        if (selectedActor) {
            await updateActorPreview(
                selectedActor,
                selectedActorMovies.length
            );
        }

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

async function saveSelectedActorPhoto(event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }

    if (!selectedActor) {
        setPhotoStatus(
            "Zoek eerst een acteur of actrice.",
            "error"
        );
        return;
    }

    if (!actorPhotoDirectoryHandle) {
        setPhotoStatus(
            "Kies eerst de acteursfotomap.",
            "error"
        );
        return;
    }

    /*
    Belangrijk:
    We gebruiken hier bewust géén alert().
    In Chrome kan een alert na het schrijven naar een lokale map
    de focus en de afbeeldingsweergave verstoren.
    De bestaande preview wordt daarom helemaal niet aangeraakt.
    */
    const originalButtonText = testActorPhotoBtn.textContent;

    testActorPhotoBtn.disabled = true;
    testActorPhotoBtn.textContent = "⏳ Foto opslaan...";

    actorPreviewMeta.textContent =
        "Foto wordt opgeslagen en gecontroleerd…";

    try {
        const candidateToSave =
            selectedActorPhotoCandidate || selectedActor;

        const result =
            await saveActorPhotoCandidate(
                candidateToSave,
                null,
                { overwrite: selectedActorHasLocalPhoto }
            );

        if (result === "downloaded") {
            actorPreviewMeta.textContent =
                "✅ Foto succesvol opgeslagen als " +
                createActorPhotoFilename(selectedActor.name);

            setPhotoStatus(
                "Foto van " +
                selectedActor.name +
                " is opgeslagen en gecontroleerd.",
                "success"
            );

            selectedActorHasLocalPhoto = true;
            updateActorPhotoSaveControls();

        } else if (result === "existing") {
            actorPreviewMeta.textContent =
                "✅ Deze foto stond al in de acteursmap.";

            setPhotoStatus(
                "De foto van " +
                selectedActor.name +
                " stond al in de acteursmap.",
                "success"
            );

        } else if (result === "missing") {
            actorPreviewMeta.textContent =
                "TMDB heeft geen foto voor deze acteur.";

            setPhotoStatus(
                "TMDB heeft geen foto voor " +
                selectedActor.name +
                ".",
                "error"
            );

        } else {
            const reason =
                lastActorPhotoSaveError ||
                "onbekende fout";

            actorPreviewMeta.textContent =
                "❌ Opslaan mislukt: " + reason;

            setPhotoStatus(
                "Opslaan mislukt: " + reason,
                "error"
            );
        }

    } catch (error) {
        const reason =
            error && error.message
                ? error.message
                : "Onbekende fout.";

        console.error(
            "Geselecteerde acteurfoto opslaan mislukt:",
            error
        );

        actorPreviewMeta.textContent =
            "❌ Opslaan mislukt: " + reason;

        setPhotoStatus(
            "Opslaan mislukt: " + reason,
            "error"
        );

    } finally {
        /*
        De preview blijft onaangeroerd. Alleen de knoptekst en
        beschikbaarheid worden opnieuw op de actuele keuze afgestemd.
        */
        updateActorPhotoSaveControls();
    }
}

function restoreActorPreviewSnapshot(snapshot) {
    if (!snapshot) {
        return;
    }

    if (snapshot.src) {
        actorPreviewImage.setAttribute("src", snapshot.src);
    } else {
        actorPreviewImage.removeAttribute("src");
    }

    actorPreviewImage.setAttribute("alt", snapshot.alt);

    actorPreviewImage.classList.toggle(
        "hidden",
        snapshot.imageWasHidden
    );

    actorPreviewPlaceholder.classList.toggle(
        "hidden",
        snapshot.placeholderWasHidden
    );

    actorPreviewCard.classList.toggle(
        "hidden",
        snapshot.cardWasHidden
    );

    actorPreviewName.textContent = snapshot.name;
    actorPreviewMeta.textContent = snapshot.meta;
}

async function saveActorPhotoCandidate(
    candidate,
    existingPhotoIndex,
    options = {}
) {
    lastActorPhotoSaveError = "";

    if (!candidate || !candidate.name) {
        lastActorPhotoSaveError =
            "De geselecteerde acteur bevat geen geldige naam.";
        return "failed";
    }

    if (!candidate.profile_path) {
        return "missing";
    }

    if (!actorPhotoDirectoryHandle) {
        lastActorPhotoSaveError =
            "Er is geen acteursfotomap geselecteerd.";
        return "failed";
    }

    const filename =
        createActorPhotoFilename(candidate.name);
    const actorKey =
        createActorPhotoIdentity(candidate.name);

    try {
        const permissionGranted =
            await requestDirectoryPermission(
                actorPhotoDirectoryHandle
            );

        if (!permissionGranted) {
            throw new Error(
                "Chrome heeft geen schrijftoestemming voor de gekozen map."
            );
        }

        const overwrite = Boolean(options.overwrite);

        if (
            !overwrite &&
            existingPhotoIndex &&
            existingPhotoIndex.has(actorKey)
        ) {
            return "existing";
        }

        if (
            !overwrite &&
            !existingPhotoIndex &&
            await actorPhotoExists(candidate.name)
        ) {
            return "existing";
        }

        const imageUrl =
            "https://image.tmdb.org/t/p/w500" +
            candidate.profile_path;

        const response = await fetch(
            imageUrl,
            {
                method: "GET",
                mode: "cors",
                cache: "no-store"
            }
        );

        if (!response.ok) {
            throw new Error(
                "De afbeelding kon niet bij TMDB worden opgehaald " +
                "(HTTP " + response.status + ")."
            );
        }

        const blob = await response.blob();

        if (!blob || blob.size === 0) {
            throw new Error(
                "TMDB stuurde een leeg afbeeldingsbestand terug."
            );
        }

        const fileHandle =
            await actorPhotoDirectoryHandle.getFileHandle(
                filename,
                {
                    create: true
                }
            );

        const writable =
            await fileHandle.createWritable();

        await writable.write(blob);
        await writable.close();

        const savedFile =
            await fileHandle.getFile();

        if (!savedFile || savedFile.size === 0) {
            throw new Error(
                "Het bestand is aangemaakt, maar bevat geen afbeelding."
            );
        }

        if (existingPhotoIndex) {
            existingPhotoIndex.set(actorKey, filename);
        }

        return "downloaded";

    } catch (error) {
        lastActorPhotoSaveError =
            error && error.message
                ? error.message
                : String(error || "Onbekende fout.");

        console.error(
            "Foto opslaan mislukt:",
            candidate.name,
            error
        );

        return "failed";
    }
}

async function fillMissingActorPhotos() {
    if (bulkPhotoScanRunning) {
        return;
    }

    if (importedMovies.length === 0) {
        alert("Laad eerst de MovieMind-database.");
        return;
    }

    if (!actorPhotoDirectoryHandle) {
        alert("Kies eerst de map game/images/actors.");
        return;
    }

    const permission =
        await requestDirectoryPermission(
            actorPhotoDirectoryHandle
        );

    if (!permission) {
        alert(
            "De importer heeft geen schrijftoestemming voor de acteursfotomap."
        );
        return;
    }

    const actorNames = collectUniqueActorNames();

    if (actorNames.length === 0) {
        alert("In de geladen database zijn geen acteurs gevonden.");
        return;
    }

    const startedAt = Date.now();

    bulkPhotoScanRunning = true;
    setImporterBusy(true);
    resetPhotoProgress(actorNames.length);
    photoBulkProgress.classList.remove("hidden");

    setPhotoStatus(
        actorNames.length +
        " unieke acteurs gevonden. De fotomap wordt gecontroleerd…"
    );

    let downloaded = 0;
    let existing = 0;
    let missing = 0;
    let failed = 0;
    let review = 0;
    bulkPhotoReviewItems = [];
    bulkPhotoProblemItems = [];
    renderPhotoReviewList();

    try {
        const existingPhotoIndex =
            await buildActorPhotoIndex();

        for (
            let index = 0;
            index < actorNames.length;
            index++
        ) {
            const actorName = actorNames[index];
            const actorNumber = index + 1;
            const actorKey =
                createActorPhotoIdentity(actorName);

            updatePhotoProgress(
                actorNumber,
                actorNames.length,
                actorName,
                downloaded,
                existing,
                missing,
                failed,
                review
            );

            if (existingPhotoIndex.has(actorKey)) {
                existing++;
                continue;
            }

            try {
                const photoChoice =
                    await findBestActorPhotoCandidate(actorName);

                if (!photoChoice || !photoChoice.candidate) {
                    missing++;
                    bulkPhotoProblemItems.push({
                        name: actorName,
                        type: "Geen foto",
                        reason: "Geen betrouwbare TMDB-match of geen beschikbaar portret"
                    });
                    renderPhotoReviewList();
                } else {
                    const result =
                        await saveActorPhotoCandidate(
                            photoChoice.candidate,
                            existingPhotoIndex
                        );

                    if (result === "downloaded") {
                        downloaded++;

                        if (photoChoice.reviewRecommended) {
                            review++;
                            bulkPhotoReviewItems.push({
                                name: actorName,
                                reason: photoChoice.reviewReason
                            });
                            renderPhotoReviewList();
                        }
                    } else if (result === "existing") {
                        existing++;
                    } else if (result === "missing") {
                        missing++;
                        bulkPhotoProblemItems.push({
                            name: actorName,
                            type: "Geen foto",
                            reason: "TMDB-resultaat bevatte geen bruikbaar portret"
                        });
                        renderPhotoReviewList();
                    } else {
                        failed++;
                        bulkPhotoProblemItems.push({
                            name: actorName,
                            type: "Mislukt",
                            reason: lastActorPhotoSaveError || "Opslaan van de foto is mislukt"
                        });
                        renderPhotoReviewList();
                    }
                }
            } catch (error) {
                console.error(
                    "Acteursfoto aanvullen mislukt:",
                    actorName,
                    error
                );

                failed++;
                bulkPhotoProblemItems.push({
                    name: actorName,
                    type: "Mislukt",
                    reason: error && error.message ? error.message : "Onbekende fout"
                });
                renderPhotoReviewList();
            }

            updatePhotoProgress(
                actorNumber,
                actorNames.length,
                actorName,
                downloaded,
                existing,
                missing,
                failed,
                review
            );

            /*
            Korte pauze tussen TMDB-zoekopdrachten.
            Hierdoor blijft de interface rustig en wordt de API
            niet onnodig snel achter elkaar aangeroepen.
            */
            await wait(90);
        }

        const seconds =
            Math.max(
                1,
                Math.round((Date.now() - startedAt) / 1000)
            );

        photoProgressTitle.textContent =
            "Controle afgerond";
        photoCurrentActor.textContent =
            "Alle acteurs uit de database zijn nagelopen.";

        setPhotoStatus(
            "Klaar: " +
            downloaded +
            " nieuwe foto’s opgeslagen, " +
            existing +
            " bestonden al, " +
            missing +
            " zonder TMDB-foto en " +
            failed +
            " mislukt en " +
            review +
            " voor handmatige controle.",
            failed > 0 ? "error" : "success"
        );

        alert(
            "Acteursfoto’s gecontroleerd!\n\n" +
            "Films in database: " +
            importedMovies.length +
            "\nUnieke acteurs: " +
            actorNames.length +
            "\nNieuwe foto’s: " +
            downloaded +
            "\nBestonden al: " +
            existing +
            "\nGeen TMDB-foto: " +
            missing +
            "\nMislukt: " +
            failed +
            "\nHandmatige controle: " +
            review +
            "\nTijd: " +
            formatDuration(seconds)
        );

        if (selectedActor) {
            await updateActorPreview(
                selectedActor,
                selectedActorMovies.length
            );
        }

    } catch (error) {
        console.error(
            "Complete fotocontrole mislukt:",
            error
        );

        setPhotoStatus(
            "De complete fotocontrole is onverwacht gestopt. Reeds opgeslagen foto’s blijven gewoon staan.",
            "error"
        );

        alert(
            "De fotocontrole is onverwacht gestopt. " +
            "Foto’s die al waren opgeslagen blijven behouden."
        );

    } finally {
        bulkPhotoScanRunning = false;
        setImporterBusy(false);
        updatePhotoTestButton();
        updateSelectionState();
    }
}

function collectUniqueActorNames() {
    const unique = new Map();

    importedMovies.forEach(function (movie) {
        const actors =
            Array.isArray(movie && movie.actors)
                ? movie.actors
                : [];

        actors.forEach(function (actor) {
            const name =
                typeof actor === "string"
                    ? actor
                    : (
                        actor &&
                        typeof actor.name === "string"
                            ? actor.name
                            : ""
                    );

            const cleanName = String(name || "").trim();

            if (!cleanName) {
                return;
            }

            const key = normalizeText(cleanName);

            if (!unique.has(key)) {
                unique.set(key, cleanName);
            }
        });
    });

    return Array.from(unique.values()).sort(
        function (a, b) {
            return a.localeCompare(
                b,
                "nl",
                {
                    sensitivity: "base"
                }
            );
        }
    );
}

async function findExactActorPhotoCandidate(name) {
    const photoChoice = await findBestActorPhotoCandidate(name);
    return photoChoice ? photoChoice.candidate : null;
}

async function fetchJsonWithRetry(url, label, attempts) {
    const maxAttempts = Number(attempts) || 3;
    let lastError = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            const response = await fetch(url, {
                method: "GET",
                mode: "cors",
                cache: "no-store"
            });

            if (!response.ok) {
                const retryable = response.status === 429 || response.status >= 500;
                if (!retryable) {
                    throw new Error(label + " (HTTP " + response.status + ").");
                }
                throw new Error(label + " tijdelijk niet beschikbaar (HTTP " + response.status + ").");
            }

            return await response.json();
        } catch (error) {
            lastError = error;
            if (attempt < maxAttempts) {
                await wait(350 * attempt);
            }
        }
    }

    throw lastError || new Error(label + " mislukt.");
}

function buildActorSearchQueries(name) {
    const clean = String(name || "").replace(/\s+/g, " ").trim();
    const simplified = clean
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[’']/g, "")
        .replace(/[-–—]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    return Array.from(new Set([clean, simplified].filter(Boolean)));
}

function chooseBestActorSearchResult(results, requestedName) {
    const requestedNormal = normalizeText(requestedName);
    const requestedIdentity = createActorPhotoIdentity(requestedName);

    const ranked = (results || [])
        .filter(function (person) {
            return person && person.id && person.name;
        })
        .map(function (person) {
            const exactNormal = normalizeText(person.name) === requestedNormal;
            const exactIdentity = createActorPhotoIdentity(person.name) === requestedIdentity;
            const isActor = person.known_for_department === "Acting" || !person.known_for_department;
            let matchScore = 0;

            if (exactNormal) matchScore += 1000;
            if (exactIdentity) matchScore += 700;
            if (isActor) matchScore += 100;
            if (person.profile_path) matchScore += 20;
            matchScore += Math.min(50, Number(person.popularity) || 0);

            return { person: person, score: matchScore, exact: exactNormal || exactIdentity };
        })
        .filter(function (entry) {
            return entry.exact;
        })
        .sort(function (a, b) {
            return b.score - a.score;
        });

    return ranked.length ? ranked[0].person : null;
}

async function findBestActorPhotoCandidate(name) {
    const queries = buildActorSearchQueries(name);
    let actor = null;

    for (const query of queries) {
        const searchUrl =
            "https://api.themoviedb.org/3/search/person" +
            "?api_key=" + TMDB_API_KEY +
            "&language=en-US" +
            "&include_adult=false" +
            "&query=" + encodeURIComponent(query);

        const data = await fetchJsonWithRetry(
            searchUrl,
            "Acteur zoeken mislukt",
            3
        );

        actor = chooseBestActorSearchResult(data.results || [], name);
        if (actor) {
            break;
        }
    }

    if (!actor) {
        return null;
    }

    const imagesUrl =
        "https://api.themoviedb.org/3/person/" +
        actor.id +
        "/images" +
        "?api_key=" + TMDB_API_KEY;

    let imagesData = { profiles: [] };

    try {
        imagesData = await fetchJsonWithRetry(
            imagesUrl,
            "Acteurfoto’s ophalen mislukt",
            3
        );
    } catch (error) {
        console.warn("Alternatieve portretten ophalen mislukt:", actor.name, error);
    }

    const unique = new Map();

    if (actor.profile_path) {
        unique.set(actor.profile_path, {
            file_path: actor.profile_path,
            width: 0,
            height: 0,
            vote_average: 0,
            vote_count: 0,
            isDefault: true
        });
    }

    (imagesData.profiles || []).forEach(function (profile) {
        if (profile && profile.file_path) {
            unique.set(profile.file_path, profile);
        }
    });

    const profiles = Array.from(unique.values()).sort(scoreActorProfile);

    if (profiles.length === 0) {
        return null;
    }

    const best = profiles[0];
    const second = profiles[1] || null;
    const bestScore = calculateActorProfileScore(best);
    const secondScore = second ? calculateActorProfileScore(second) : null;
    const scoreGap = secondScore === null ? null : bestScore - secondScore;

    let reviewRecommended = false;
    let reviewReason = "";

    if (bestScore < 6) {
        reviewRecommended = true;
        reviewReason = "lage automatische kwaliteitsscore";
    } else if (scoreGap !== null && scoreGap < 0.8) {
        reviewRecommended = true;
        reviewReason = "meerdere bijna gelijkwaardige portretten";
    } else if (profiles.length === 1) {
        reviewRecommended = true;
        reviewReason = "slechts één TMDB-portret beschikbaar";
    }

    return {
        candidate: {
            id: actor.id,
            name: name,
            profile_path: best.file_path
        },
        matchedTmdbName: actor.name,
        reviewRecommended: reviewRecommended,
        reviewReason: reviewReason,
        score: bestScore,
        alternatives: profiles.length
    };
}

async function buildActorPhotoIndex() {
    const index = new Map();

    if (!actorPhotoDirectoryHandle) {
        return index;
    }

    for await (
        const [filename, handle]
        of actorPhotoDirectoryHandle.entries()
    ) {
        if (!handle || handle.kind !== "file") {
            continue;
        }

        if (!isSupportedActorPhotoFilename(filename)) {
            continue;
        }

        const key =
            createActorPhotoIdentity(filename);

        if (key && !index.has(key)) {
            index.set(key, filename);
        }
    }

    return index;
}

async function actorPhotoExists(name) {
    const actorKey =
        createActorPhotoIdentity(name);

    if (!actorKey || !actorPhotoDirectoryHandle) {
        return false;
    }

    for await (
        const [filename, handle]
        of actorPhotoDirectoryHandle.entries()
    ) {
        if (
            handle &&
            handle.kind === "file" &&
            isSupportedActorPhotoFilename(filename) &&
            createActorPhotoIdentity(filename) === actorKey
        ) {
            return true;
        }
    }

    return false;
}

async function findExistingActorPhotoFile(name) {
    const actorKey =
        createActorPhotoIdentity(name);

    if (!actorKey || !actorPhotoDirectoryHandle) {
        return null;
    }

    for await (
        const [filename, handle]
        of actorPhotoDirectoryHandle.entries()
    ) {
        if (
            handle &&
            handle.kind === "file" &&
            isSupportedActorPhotoFilename(filename) &&
            createActorPhotoIdentity(filename) === actorKey
        ) {
            return handle.getFile();
        }
    }

    return null;
}

function createActorPhotoIdentity(value) {
    return String(value || "")
        .trim()
        .toLowerCase()
        .replace(/\.(jpe?g|png|webp)$/i, "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/&/g, " and ")
        .replace(/['’]/g, "")
        .replace(/[^a-z0-9]+/g, "");
}

function isSupportedActorPhotoFilename(filename) {
    return /\.(jpe?g|png|webp)$/i.test(
        String(filename || "")
    );
}

function resetPhotoProgress(total) {
    photoProgressTitle.textContent =
        "Acteursfoto’s aanvullen";
    photoProgressCounter.textContent =
        "0 / " + total;
    photoProgressFill.style.width = "0%";
    photoCurrentActor.textContent =
        "Bestaande bestanden in de fotomap controleren…";
    photoDownloadedCount.textContent = "0";
    photoExistingCount.textContent = "0";
    photoMissingCount.textContent = "0";
    photoFailedCount.textContent = "0";
    photoReviewCount.textContent = "0";
    bulkPhotoReviewItems = [];
    bulkPhotoProblemItems = [];
    renderPhotoReviewList();
}

function updatePhotoProgress(
    current,
    total,
    actorName,
    downloaded,
    existing,
    missing,
    failed,
    review
) {
    const percentage =
        total > 0
            ? Math.min(
                100,
                Math.round((current / total) * 100)
            )
            : 0;

    photoProgressCounter.textContent =
        current + " / " + total;
    photoProgressFill.style.width =
        percentage + "%";
    photoCurrentActor.textContent =
        "Bezig met: " + actorName;
    photoDownloadedCount.textContent =
        String(downloaded);
    photoExistingCount.textContent =
        String(existing);
    photoMissingCount.textContent =
        String(missing);
    photoFailedCount.textContent =
        String(failed);
    photoReviewCount.textContent =
        String(review || 0);
}

function formatDuration(totalSeconds) {
    if (totalSeconds < 60) {
        return totalSeconds + " seconden";
    }

    const minutes =
        Math.floor(totalSeconds / 60);
    const seconds =
        totalSeconds % 60;

    return (
        minutes +
        " min " +
        seconds +
        " sec"
    );
}

function wait(milliseconds) {
    return new Promise(function (resolve) {
        setTimeout(resolve, milliseconds);
    });
}

async function updateActorPreview(actor, movieCount) {
    if (actorPreviewObjectUrl) {
        URL.revokeObjectURL(actorPreviewObjectUrl);
        actorPreviewObjectUrl = null;
    }

    if (!actor) {
        selectedActorPhotoCandidate = null;
        selectedActorHasLocalPhoto = false;
        actorPhotoChoiceRequestId++;

        actorPreviewImage.removeAttribute("src");
        actorPreviewImage.classList.add("hidden");
        actorPreviewPlaceholder.classList.remove("hidden");
        actorPreviewName.textContent =
            "Nog niemand gekozen";
        actorPreviewMeta.textContent =
            "Zoek een acteur om de foto te bekijken.";

        if (actorPhotoChoices) {
            actorPhotoChoices.innerHTML = "";
        }

        if (actorPhotoChoicesStatus) {
            actorPhotoChoicesStatus.textContent =
                "Zoek een acteur om beschikbare TMDB-foto’s te bekijken.";
        }

        updateActorPhotoSaveControls();
        return;
    }

    actorPreviewName.textContent = actor.name;
    actorPreviewMeta.textContent =
        typeof movieCount === "number"
            ? (
                movieCount +
                (movieCount === 1
                    ? " film gevonden"
                    : " films gevonden")
            )
            : "Acteur geselecteerd";

    actorPreviewImage.alt =
        "Foto van " + actor.name;

    let imageSource = "";
    selectedActorHasLocalPhoto = false;

    try {
        const localPhoto =
            await findExistingActorPhotoFile(actor.name);

        if (localPhoto) {
            actorPreviewObjectUrl =
                URL.createObjectURL(localPhoto);
            imageSource = actorPreviewObjectUrl;
            selectedActorHasLocalPhoto = true;
        }
    } catch (error) {
        console.warn(
            "Lokale acteurfoto bekijken mislukt:",
            error
        );
    }

    selectedActorPhotoCandidate = {
        id: actor.id,
        name: actor.name,
        profile_path: actor.profile_path || null
    };

    if (!imageSource && actor.profile_path) {
        imageSource =
            "https://image.tmdb.org/t/p/w500" +
            actor.profile_path;
    }

    showActorPreviewSource(imageSource, actor.name);
    actorPreviewCard.classList.remove("hidden");
    updateActorPhotoSaveControls();
}

function showActorPreviewSource(imageSource, actorName) {
    if (imageSource) {
        actorPreviewImage.src = imageSource;
        actorPreviewImage.alt = "Foto van " + actorName;
        actorPreviewImage.classList.remove("hidden");
        actorPreviewPlaceholder.classList.add("hidden");
    } else {
        actorPreviewImage.removeAttribute("src");
        actorPreviewImage.classList.add("hidden");
        actorPreviewPlaceholder.classList.remove("hidden");
    }
}

function updateActorPhotoSaveControls() {
    const canSave = Boolean(
        selectedActor &&
        actorPhotoDirectoryHandle &&
        selectedActorPhotoCandidate &&
        selectedActorPhotoCandidate.profile_path
    );

    testActorPhotoBtn.disabled =
        bulkPhotoScanRunning || !canSave;

    testActorPhotoBtn.textContent =
        selectedActorHasLocalPhoto
            ? "🔄 Gekozen foto vervangen"
            : "📸 Gekozen foto opslaan";

    if (actorPhotoAlreadyExistsMessage) {
        actorPhotoAlreadyExistsMessage.classList.toggle(
            "hidden",
            !selectedActorHasLocalPhoto
        );
    }
}

async function loadActorPhotoChoices(actor) {
    const requestId = ++actorPhotoChoiceRequestId;

    if (!actor || !actor.id || !actorPhotoChoices) {
        return;
    }

    actorPhotoChoices.innerHTML = "";
    actorPhotoChoicesStatus.textContent =
        "Beschikbare TMDB-foto’s ophalen…";

    try {
        const response = await fetch(
            "https://api.themoviedb.org/3/person/" +
            actor.id +
            "/images" +
            "?api_key=" + TMDB_API_KEY
        );

        if (!response.ok) {
            throw new Error("Acteurfoto’s ophalen mislukt.");
        }

        const data = await response.json();

        if (requestId !== actorPhotoChoiceRequestId) {
            return;
        }

        const unique = new Map();

        if (actor.profile_path) {
            unique.set(actor.profile_path, {
                file_path: actor.profile_path,
                width: 0,
                height: 0,
                vote_average: 0,
                vote_count: 0,
                isDefault: true
            });
        }

        (data.profiles || []).forEach(function (profile) {
            if (profile && profile.file_path) {
                unique.set(profile.file_path, profile);
            }
        });

        const profiles = Array.from(unique.values())
            .sort(scoreActorProfile)
            .slice(0, 8);

        if (profiles.length === 0) {
            actorPhotoChoicesStatus.textContent =
                "TMDB heeft geen alternatieve portretfoto’s voor deze acteur.";
            return;
        }

        actorPhotoChoicesStatus.textContent =
            "Klik op de mooiste foto. Die wordt daarna opgeslagen.";

        profiles.forEach(function (profile, index) {
            const candidate = {
                id: actor.id,
                name: actor.name,
                profile_path: profile.file_path
            };

            const button = document.createElement("button");
            button.type = "button";
            button.className = "actor-photo-choice";
            button.dataset.profilePath = profile.file_path;
            button.setAttribute(
                "aria-label",
                "Kies foto " + (index + 1) + " van " + actor.name
            );

            const image = document.createElement("img");
            image.loading = "lazy";
            image.alt = "Foto-optie " + (index + 1) + " van " + actor.name;
            image.src =
                "https://image.tmdb.org/t/p/w185" +
                profile.file_path;

            button.appendChild(image);

            button.addEventListener("click", function () {
                selectedActorPhotoCandidate = candidate;

                actorPhotoChoices
                    .querySelectorAll(".actor-photo-choice")
                    .forEach(function (choice) {
                        choice.classList.remove("selected");
                    });

                button.classList.add("selected");

                showActorPreviewSource(
                    "https://image.tmdb.org/t/p/w500" +
                    profile.file_path,
                    actor.name
                );

                actorPreviewMeta.textContent =
                    "Foto " + (index + 1) +
                    " geselecteerd. Klik op de groene knop om op te slaan.";

                updateActorPhotoSaveControls();
            });

            actorPhotoChoices.appendChild(button);
        });

        const selectedPath =
            selectedActorPhotoCandidate &&
            selectedActorPhotoCandidate.profile_path;

        const initiallySelected =
            actorPhotoChoices.querySelector(
                '[data-profile-path="' +
                CSS.escape(selectedPath || "") +
                '"]'
            ) || actorPhotoChoices.firstElementChild;

        if (initiallySelected) {
            initiallySelected.classList.add("selected");

            if (!selectedPath) {
                initiallySelected.click();
            }
        }

    } catch (error) {
        console.error("Acteurfoto-opties ophalen mislukt:", error);

        if (requestId === actorPhotoChoiceRequestId) {
            actorPhotoChoicesStatus.textContent =
                "De extra TMDB-foto’s konden niet worden opgehaald. " +
                "De standaardfoto blijft wel bruikbaar.";
        }
    }
}

function calculateActorProfileScore(profile) {
    const width = Number(profile.width) || 0;
    const height = Number(profile.height) || 0;
    const ratio = height > 0 ? width / height : 0.8;
    const portraitFit = Math.max(0, 1 - Math.abs(ratio - 0.8));
    const resolution = Math.min(4, (width * height) / 1000000);
    const votes = Math.min(3, Number(profile.vote_count) / 10);
    const rating = Math.min(2, Number(profile.vote_average) / 5);
    const defaultBonus = profile.isDefault ? 0.35 : 0;

    return (
        portraitFit * 5 +
        resolution +
        votes +
        rating +
        defaultBonus
    );
}

function scoreActorProfile(a, b) {
    return (
        calculateActorProfileScore(b) -
        calculateActorProfileScore(a)
    );
}

function renderPhotoReviewList() {
    if (!photoReviewPanel || !photoReviewList) {
        return;
    }

    const allItems = bulkPhotoReviewItems
        .map(function (item) {
            return { name: item.name, type: "Controle", reason: item.reason };
        })
        .concat(bulkPhotoProblemItems);

    photoReviewList.innerHTML = "";
    photoReviewPanel.classList.toggle("hidden", allItems.length === 0);

    allItems.forEach(function (item) {
        const listItem = document.createElement("li");
        const name = document.createElement("strong");
        const reason = document.createElement("span");

        name.textContent = item.name + " — " + (item.type || "Controle");
        reason.textContent = item.reason || "controle aanbevolen";

        listItem.appendChild(name);
        listItem.appendChild(reason);
        photoReviewList.appendChild(listItem);
    });
}

function downloadPhotoReviewList() {
    const allItems = bulkPhotoReviewItems
        .map(function (item) {
            return { name: item.name, type: "Controle", reason: item.reason };
        })
        .concat(bulkPhotoProblemItems);

    if (allItems.length === 0) {
        alert("Er staan nog geen acteurs op de resultatenlijst.");
        return;
    }

    const lines = [
        "MovieMind — resultaten acteursfotoscan",
        "",
        ...allItems.map(function (item) {
            return item.name + " — " + item.type + " — " + item.reason;
        })
    ];

    const blob = new Blob(
        [lines.join("\n")],
        { type: "text/plain;charset=utf-8" }
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "moviemind_acteursfotos_scan_resultaten.txt";
    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(function () {
        URL.revokeObjectURL(url);
    }, 1000);
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

function updatePhotoTestButton() {
    updateActorPhotoSaveControls();

    fillMissingActorPhotosBtn.disabled =
        bulkPhotoScanRunning ||
        !actorPhotoDirectoryHandle ||
        importedMovies.length === 0;
}

function setPhotoStatus(message, state) {
    photoStatus.textContent = message;
    photoStatus.className =
        "info-box" + (state ? " " + state : "");
}


/* =========================================================
   ACTIEVE DATABASE VEILIG ONTHOUDEN
========================================================= */

async function saveActiveDatabase() {
    try {
        const database = await openPhotoDatabase();

        await new Promise(function (resolve, reject) {
            const transaction = database.transaction(
                PHOTO_STORE_NAME,
                "readwrite"
            );

            transaction
                .objectStore(PHOTO_STORE_NAME)
                .put(
                    {
                        films: importedMovies,
                        fileName: loadedDatabaseFileName,
                        savedAt: Date.now()
                    },
                    ACTIVE_DATABASE_KEY
                );

            transaction.oncomplete = resolve;
            transaction.onerror = function () {
                reject(transaction.error);
            };
        });

        database.close();
    } catch (error) {
        console.error("Actieve database onthouden mislukt:", error);
    }
}

async function restoreActiveDatabase() {
    try {
        if (!("indexedDB" in window)) {
            return;
        }

        const database = await openPhotoDatabase();

        const saved = await new Promise(function (resolve, reject) {
            const transaction = database.transaction(
                PHOTO_STORE_NAME,
                "readonly"
            );

            const request = transaction
                .objectStore(PHOTO_STORE_NAME)
                .get(ACTIVE_DATABASE_KEY);

            request.onsuccess = function () {
                resolve(request.result || null);
            };

            request.onerror = function () {
                reject(request.error);
            };
        });

        database.close();

        if (!saved || !Array.isArray(saved.films) || saved.films.length === 0) {
            return;
        }

        importedMovies = deduplicateMovies(saved.films);
        loadedDatabaseFileName =
            saved.fileName || "moviemind_database.json";
        lastAddedMovie = null;

        refreshDatabasePanel();
        refreshVisibleMovieCards();

        console.info(
            importedMovies.length +
            " films uit de lokaal onthouden database hersteld."
        );
    } catch (error) {
        console.error("Actieve database herstellen mislukt:", error);
    }
}


/* =========================================================
   FOTOHANDLE ONTHOUDEN
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
    const options = {
        mode: "readwrite"
    };

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

            updatePhotoTestButton();

            if (selectedActor) {
                await updateActorPreview(
                    selectedActor,
                    selectedActorMovies.length
                );
            }
        } else {
            setPhotoStatus(
                "Fotomap onthouden: " +
                handle.name +
                ". Klik één keer op ‘Acteursfotomap kiezen’ om toestemming te geven."
            );
        }

    } catch (error) {
        console.error(
            "Fotomap herstellen mislukt:",
            error
        );
    }
}


/* =========================================================
   SUGGESTIES
========================================================= */

let movieSuggestionTimer = null;
let actorSuggestionTimer = null;

movieTitleInput.addEventListener("input", function () {
    clearTimeout(movieSuggestionTimer);

    const query = movieTitleInput.value.trim();

    if (query.length < 2) {
        movieSuggestions.classList.add("hidden");
        return;
    }

    movieSuggestionTimer = setTimeout(function () {
        loadMovieSuggestions(query);
    }, 300);
});

actorNameInput.addEventListener("input", function () {
    clearTimeout(actorSuggestionTimer);

    selectedActor = null;
    selectedActorMovies = [];
    updatePhotoTestButton();
    updateActorPreview(null);

    const query = actorNameInput.value.trim();

    if (query.length < 2) {
        actorSuggestions.classList.add("hidden");
        return;
    }

    actorSuggestionTimer = setTimeout(function () {
        loadActorSuggestions(query);
    }, 300);
});

async function loadMovieSuggestions(query) {
    try {
        const response = await fetch(
            "https://api.themoviedb.org/3/search/movie" +
            "?api_key=" + TMDB_API_KEY +
            "&language=en-US" +
            "&include_adult=false" +
            "&query=" + encodeURIComponent(query)
        );

        const data = await response.json();

        renderSuggestions(
            movieSuggestions,
            (data.results || [])
                .filter(function (movie) {
                    return movie.id && movie.title;
                })
                .slice(0, 8)
                .map(function (movie) {
                    return {
                        title: movie.title,
                        subtitle: movie.release_date
                            ? movie.release_date.slice(0, 4)
                            : "jaar onbekend",
                        onClick: function () {
                            movieTitleInput.value = movie.title;
                            movieSuggestions.classList.add("hidden");
                            searchMovie();
                        }
                    };
                })
        );

    } catch (error) {
        movieSuggestions.classList.add("hidden");
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
                                return item.title || item.name;
                            })
                            .filter(Boolean)
                            .slice(0, 2)
                            .join(" • ") || "Filmografie beschikbaar",
                        onClick: function () {
                            selectedActor = {
                                id: person.id,
                                name: person.name,
                                profile_path:
                                    person.profile_path || null
                            };

                            actorNameInput.value = person.name;
                            actorSuggestions.classList.add("hidden");
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

        button.addEventListener(
            "click",
            suggestion.onClick
        );

        container.appendChild(button);
    });

    container.classList.remove("hidden");
}

function hideSuggestions() {
    movieSuggestions.classList.add("hidden");
    actorSuggestions.classList.add("hidden");
}

document.addEventListener("click", function (event) {
    if (
        !movieSuggestions.contains(event.target) &&
        event.target !== movieTitleInput
    ) {
        movieSuggestions.classList.add("hidden");
    }

    if (
        !actorSuggestions.contains(event.target) &&
        event.target !== actorNameInput
    ) {
        actorSuggestions.classList.add("hidden");
    }
});


/* =========================================================
   HULPFUNCTIES
========================================================= */

function normalizeText(text) {
    return String(text || "")
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
}

function isAllowedActorCredit(movie) {
    if (
        !movie ||
        !movie.id ||
        !movie.title ||
        !movie.release_date
    ) {
        return false;
    }

    const title = String(movie.title).toLowerCase();
    const character =
        String(movie.character || "").toLowerCase();

    const unwantedCharacters = [
        "self",
        "himself",
        "herself",
        "themselves",
        "narrator",
        "host",
        "presenter",
        "archive footage",
        "archival footage"
    ];

    const unwantedTitles = [
        "making of",
        "behind the scenes",
        "featurette",
        "wwe",
        "wrestlemania",
        "royal rumble",
        "summerslam",
        "smackdown",
        "monday night raw",
        "dvd extras",
        "bonus material"
    ];

    return (
        !unwantedCharacters.some(function (item) {
            return character.includes(item);
        }) &&
        !unwantedTitles.some(function (item) {
            return title.includes(item);
        })
    );
}


function restoreSearchTab() {
    let savedTab = "movie";

    try {
        savedTab =
            localStorage.getItem(ACTIVE_SEARCH_TAB_KEY) ||
            "movie";
    } catch (error) {
        console.warn(
            "Zoektab herstellen mislukt:",
            error
        );
    }

    showSearchTab(
        savedTab === "actor" ? "actor" : "movie"
    );
}


/* =========================================================
   BEGINSTATUS
========================================================= */

refreshDatabasePanel();
updateSelectionState();
restoreSearchTab();
restoreActiveDatabase();
restorePhotoFolder();