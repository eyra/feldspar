import port.api.props as props #UI component definitions
from port.api.assets import * # component building 
from port.api.commands import CommandSystemDonate, CommandSystemExit, CommandUIRender #Backend command definitions for donating, exiting, rendering

# Import necessary libraries
import pandas as pd
import zipfile
import json
import numpy as np
import logging




# ------------------------------------------------------------------------------
# Set up a dual logging system to track and store log messages both in memory
# (for data donation) and in the console (for real-time developer feedback).
#
# This setup serves two audiences:
# - Researchers receive structured log metadata with user submissions.
# - Developers get immediate log output in the console for debugging.
# ------------------------------------------------------------------------------

# 1. `log_handler` is a custom logging handler (`DataFrameHandler`) that collects
#    all log records into an in-memory list, later converted to a DataFrame and
#    submitted as part of the metadata when users donate their data.

# A logging handler that logs all messages to an data frame.
# The first column is the log level, the second column is the message.

class DataFrameHandler(logging.Handler):
    def __init__(self):
        logging.Handler.__init__(self)
        self._data = []

    def emit(self, record): 
        #Appends the log record to an internal list.
        self._data.append({"Level": record.levelname, "Message": record.getMessage(), "Time": record.created})

    @property
    def df(self):
        #Returns the logs as a structured DataFrame.
        return pd.DataFrame(self._data)

log_handler = DataFrameHandler()
logging.basicConfig(handlers=[log_handler], level=logging.INFO)
logger = logging.getLogger(__name__)

# ------------------------------------------------------------------------------
# 2. The logger named "spotify_data_donation" is configured independently to:
#    - Log all levels (DEBUG and above).
#    - Clear any previous handlers (to avoid duplicate logs).
#    - Add a `StreamHandler` that outputs to the console with timestamps and levels.

logger = logging.getLogger("spotify_data_donation")
logger.setLevel(logging.DEBUG)
if logger.hasHandlers():
    logger.handlers.clear()

console_handler = logging.StreamHandler()
console_handler.setFormatter(logging.Formatter('%(asctime)s - %(levelname)s - %(message)s'))
logger.addHandler(console_handler)





def process(sessionId):
    """
    The main generator function orchestrating the Spotify data donation pipeline.

    This function guides the user through the full interaction flow, from uploading their
    Spotify ZIP export to parsing its contents, requesting consent, and ultimately
    submitting data and metadata (including logs) to the backend.

    Args:
        sessionId (str): Unique session identifier used to tag donations and logs.

    Workflow Breakdown:
    -------------------
    1. Prompt user for ZIP upload.
    2. Validate the file type and contents.
    3. Extract podcast/music/library data.
    4. Data Structuring
    5. Prompt user for consent to donate.
    6. Submit donation data and logs.
        

    Notes:
    ------
    - The function is written as a coroutine generator to allow UI interactions
      between each logical step (i.e., using `yield` to pause for frontend feedback).
    - Logging is integrated at each stage to provide both live developer feedback and
      structured user-side debugging support for donation auditing.

    Returns:
        Generator yielding UI components or system commands at key interaction points.
    """
    key = "spotify-data-donation"
    meta_data = [("debug", f"{key}: start")]
    
    data = None
    while True:
        
        # 1. Prompt user for ZIP upload.
        #- Prompts the user via the UI to upload their Spotify data ZIP file.
        #- Ensures uploaded content is of the correct MIME type.
        promptFile = prompt_file("application/zip")
        fileResult = yield render_data_submission_page([
            props.PropsUIPromptText(text=props.Translatable({
                "en": "Please upload your Spotify data export as ZIP file.",
                "de": "Bitte laden Sie Ihren Spotify-Datenexport als ZIP-Datei hoch.",
            })),
            promptFile,
        ])
        # 2. Validate the file type and contents.
        # - Uses `get_zipfile()` to:
        #    - Check for ZIP integrity.
        #    - Confirm presence of required Spotify export files.
        #    - Validate that meaningful data (e.g., streaming or library info) exists.
        #- Handles specific user feedback and recovery options depending on failure type:
        #    - `EmptySpotifyZipError`: Logs a minimal donation with status.
        #    - `NotAZipFileError`, `InvalidSpotifyZipError`: Prompts retry or early exit.
        if fileResult.__type__ != "PayloadString":
            logger.warning("Invalid file type received.")
            retry_result = yield render_data_submission_page(retry_confirmation())
            if retry_result.__type__ == "PayloadFalse":
                return
            continue

        try:
            zipfile_ref = get_zipfile(fileResult.value)
            
        except EmptySpotifyZipError as e:
            value = json.dumps({"status" : "no-streaming-and-library-data"})
            yield donate(f"{sessionId}-{key}", value)
            yield render_no_submission_page()
            return
            
        except (NotAZipFileError, InvalidSpotifyZipError) as e:
            retry_result = yield render_data_submission_page(retry_confirmation(
                text=props.Translatable({"en": str(e), "de": str(e)})
            ))
            if retry_result.__type__ == "PayloadFalse":
                value = json.dumps({"status" : "no-spotify-account-data-found"})
                yield donate(f"{sessionId}-{key}", value)
                return
            continue
        
        

        # 3. Extract podcast/music/library data.
        #- Runs `extract_spotify_data()` as a generator to yield UI progress steps.
        #- Attempts to load streaming and library JSON content inside the ZIP.
        #- Uses `StopIteration.value` to collect extracted podcast, music, and library data.
        #- All exceptions are caught broadly (via `Exception`) to prevent UI crash loops,though this should ideally be improved with more specific exception handling.
        try:
            #this captures all the files and breaks only if there is no next file 
            extract_gen = extract_spotify_data(zipfile_ref, meta_data, key)
            while True:
                try:
                    step = next(extract_gen)
                    yield step  # UI steps like progress
                except StopIteration as result:
                    podcast_data, music_data, library_data = result.value
                    break
        # be careful here, it always throws this execption even when there is a code error like a typo, any error that could occure, better to use explicit errors 
        except Exception as e:
            logger.exception("Fatal error during extraction.")
            meta_data.append(("error", f"{key}: extraction failed - {e}"))
            retry_result = yield render_data_submission_page(retry_confirmation())
            if retry_result.__type__ == "PayloadFalse":
                return
            continue
        
        #4. Data Structuring
        #- Transforms raw JSON lists into structured Pandas DataFrames with
        #  user-readable formatting using `spotify_data_extraction()`.
        #- If all resulting DataFrames are empty, it considers the archive uninformative
        #  and allows the user to retry or cancel.
        try:
            data = spotify_data_extraction(podcast_data, music_data, library_data)
        except Exception as e:
            logger.error(f"Data extraction failed: {e}")
            retry_result = yield render_data_submission_page(retry_confirmation(
                text=props.Translatable({
                    "en": f"Data processing failed: {e}",
                    "de": "Verarbeitung der Daten fehlgeschlagen."
                })
            ))
            if retry_result.__type__ == "PayloadFalse":
                return
            continue

        if not any(not df.empty for df in data.values()):
            logger.warning("No usable data found in the archive.")
            retry_result = yield render_data_submission_page(retry_confirmation())
            if retry_result.__type__ == "PayloadFalse":
                return
            continue

        logger.info("Data extraction successful.")
        break  # Exit loop and proceed

    # 5. Prompt user for consent to donate.
    #- Renders a visual summary of extracted data via `prompt_consent()`.
    #- Waits for explicit user consent before data is submitted.
    logger.info("Prompting user for consent.")
    while True:
        result = yield from prompt_consent(data)
    # 6. Send donation data and logs.
    #- On user approval (`PayloadJSON`), combines the user data and `meta_data` into a JSON donation payload and submits it using `donate()`.
    #    - Also submits a second payload containing logs from the session.
    #    - On rejection (`PayloadTrue`), a declined status is recorded and logged.
    #    - On "Back" (`PayloadFalse`), the user is returned to the consent screen.
        if result.__type__ == "PayloadJSON":
            logger.info("User consented. Submitting data.")
            meta_frame = pd.DataFrame(meta_data, columns=["type", "message"])
            data_submission_data = json.loads(result.value)
            data_submission_data["meta"] = meta_frame.to_json()
            yield donate(f"{sessionId}-{key}", json.dumps(data_submission_data))
            yield donate(f"{sessionId}-{key}-log", log_handler.df.to_json(orient="records"))
            yield exit(0, "User returned after successful donation.")
            return
        elif result.__type__ == "PayloadTrue":
            logger.info("User chose to exit.")
            value = json.dumps({"status": "donation declined"})
            yield donate(f"{sessionId}-{key}", value)
            yield donate(f"{sessionId}-{key}-log", log_handler.df.to_json(orient="records"))
            return
        elif result.__type__ == "PayloadFalse":
            logger.info("User chose to go back to the consent screen.")
            continue
            





def get_zipfile(file_path):
    """
    Opens and validates a user-uploaded Spotify ZIP archive.

    This function ensures the uploaded file is a valid ZIP archive and contains
    recognizable Spotify export structure. It performs a series of checks to
    confirm the presence of required metadata files and at least one type of
    meaningful user data (streaming history or library data). If validation
    passes, the ZIP file is returned for further processing.

    Args:
        file_path (str): Path to the uploaded file (as received by the backend).

    Returns:
        zipfile.ZipFile: A valid and opened ZIP archive object ready for inspection
                         or file extraction.

    Raises:
        NotAZipFileError:
            Raised when the uploaded file is not a valid ZIP archive or cannot be opened.
        InvalidSpotifyZipError:
            Raised when the ZIP file is structurally valid but does not contain expected
            Spotify metadata files (e.g., 'userdata', 'identity').
        EmptySpotifyZipError:
            Raised when the ZIP file lacks any usable content such as music/podcast
            history or library data.

    Validation Steps:
    -----------------
    1. **ZIP Format Check**:
        - Uses `zipfile.is_zipfile()` to check the file signature.
        - Raises `NotAZipFileError` if check fails.

    2. **Base File Presence**:
        - Collects all file names in the archive.
        - Verifies presence of one or more "anchor" files commonly found in Spotify
          exports such as:
            - `userdata`
            - `identifiers`
            - `identity`
        - Uses a simple substring match.
        - Raises `InvalidSpotifyZipError` if none are found.

        Note:
        This check uses a double loop (`any(req in name.lower() for name in names for req in required_files)`),
        which can become inefficient if the ZIP contains thousands of files. Consider optimizing
        this using set intersections or early-exit search strategies, if needed. 

    3. **Content Presence Check**:
        - Confirms existence of at least one user-relevant data file:
            - `"streaminghistory_music"`
            - `"streaminghistory_podcast"`
            - `"yourlibrary"`
        - Raises `EmptySpotifyZipError` if none are present.

    4. **ZIP Parsing Errors**:
        - If `zipfile.ZipFile()` fails due to corruption or unreadable content,
          `zipfile.BadZipFile` is caught and re-raised as a `NotAZipFileError`.

    Importance:
    -----------
    This function acts as a gatekeeper: only if the archive passes all checks does the
    processing pipeline continue. By catching early problems here, users are given clear
    feedback and avoid frustrating downstream errors during extraction or donation.

    UI Consideration:
    -----------------
    Errors from this function are shown to the user as retryable UI prompts
    with translated error messages and the option to exit the submission process.
    """
    if not zipfile.is_zipfile(file_path):
        raise NotAZipFileError(
            'Es sieht so aus, als hätten Sie eine falsche Datei ausgewählt. Bitte überprüfen Sie, ob Sie die originale ZIP-Datei Ihres Spotify-Datenexports geladen haben, und klicken Sie anschließend auf "Erneut versuchen", um die korrekte Datei zu laden. Mit einem Klick auf "Beenden" gelangen Sie zurück zur Übersicht. Dort können Sie die Kurzbefragung starten – wir würden uns sehr über Ihre Teilnahme freuen!'
        )

    try:
        zipfile_ref = zipfile.ZipFile(file_path, 'r')
        names = zipfile_ref.namelist()

        # Prüfung auf Spotify-typische Basisdateien
        required_files = {"userdata", "identifiers", "identity"}
        # this could be done more efficient, will become an issue if there are thousands of files 
        if not any(req in name.lower() for name in names for req in required_files):
            logger.warning("Required Spotify files not found in the ZIP archive.")
            raise InvalidSpotifyZipError(
                'Es sieht so aus, als hätten Sie eine falsche Datei ausgewählt. Bitte überprüfen Sie, ob Sie die originale ZIP-Datei Ihres Spotify-Datenexports geladen haben, und klicken Sie anschließend auf "Erneut versuchen", um die korrekte Datei zu laden. Mit einem Klick auf "Beenden" gelangen Sie zurück zur Übersicht. Dort können Sie die Kurzbefragung starten – wir würden uns sehr über Ihre Teilnahme freuen!'
            )

        # Prüfung auf enthaltene Nutzdaten
        has_music = any("streaminghistory_music" in name.lower() for name in names)
        has_podcast = any("streaminghistory_podcast" in name.lower() for name in names)
        has_library = any("yourlibrary" in name.lower() for name in names)

        if not (has_music or has_podcast or has_library):
            raise EmptySpotifyZipError(
                'Ihr Datenpaket enthält keine Daten zu Ihrem Hörverhalten auf Spotify. Mit einem Klick auf "Beenden" gelangen Sie zurück zur Übersicht. Dort können Sie die Kurzbefragung starten – wir würden uns sehr über Ihre Teilnahme freuen!'
            )

        return zipfile_ref

    except zipfile.BadZipFile:
        raise NotAZipFileError(
            'Die Datei konnte nicht gelesen werden. Bitte laden Sie die originale Spotify-ZIP-Datei erneut hoch.'
        )


def extract_spotify_data(zipfile_ref, meta_data, key):
    """
    Iterates through a Spotify data ZIP archive and extracts relevant content files,
    yielding UI progress updates at each step.

    This function targets three specific content categories typically found in a
    Spotify data export:
    - Podcast streaming history
    - Music streaming history
    - Followed content (artists and shows)

    It reads and parses any JSON files matching known filename patterns, collecting
    structured data into in-memory lists/dictionaries for further processing.

    Args:
        zipfile_ref (ZipFile): An open reference to the uploaded ZIP archive.
        meta_data (list): A mutable list that accumulates log and error metadata
                          during processing. This list is later submitted alongside
                          the donation as metadata.
        key (str): A string key identifying this process instance, used for tagging
                   metadata entries and logs.

    Yields:
        UI rendering steps (via `render_data_submission_page`) that inform the user
        about current progress while iterating through files inside the ZIP.

    Returns:
        tuple:
            - `podcast_data` (list[dict]): Parsed JSON entries from files named like
              "streaminghistory_podcast*". Each entry must include `endTime` and
              `msPlayed` to be considered valid.
            - `music_data` (list[dict]): Parsed JSON entries from files named like
              "streaminghistory_music*", filtered similarly.
            - `library_data` (dict): Dictionary containing:
                - `artists`: list of dicts with artist names the user follows.
                - `shows`: list of dicts with podcast show names the user follows.

    Implementation Details:
    -----------------------
    - File Filtering:
        The function only processes files whose names contain:
            - `"yourlibrary"`: captures user-followed content.
            - `"streaminghistory_podcast"`: podcast listening activity.
            - `"streaminghistory_music"`: music listening activity.

    - Progress Feedback:
        For each matched file, a progress bar is rendered using the file index
        and total file count to communicate extraction status to the user.

    - Error Resilience:
        Any errors during file parsing (e.g., malformed JSON or unexpected formats)
        are logged and recorded into `meta_data`, but they do not abort processing.

    - Data Validation:
        For streaming history, only JSON arrays with required fields (`endTime`,
        `msPlayed`) are accepted. For library data, only dictionaries with `"name"`
        are retained.

    Notes:
    ------
    - This function is implemented as a generator to yield progress UI components
      between steps, enabling asynchronous UI feedback during long-running operations.
    - It does not raise exceptions on failure but instead continues with best-effort
      extraction, logging warnings and skipping invalid files.
    """
    podcast_data, music_data = [], []
    library_data_raw = {}

    all_files = zipfile_ref.namelist()
    
    
    target_files = [
        f for f in all_files
        if (
            "yourlibrary" in f.lower()
            or "streaminghistory_podcast" in f.lower()
            or "streaminghistory_music" in f.lower()
        )
    ]

    

    for index, filename in enumerate(target_files):
        yield render_data_submission_page(
            prompt_extraction_message(f"Checking: {filename}", ((index + 1) / len(target_files)) * 100)
        )

        try:
            with zipfile_ref.open(filename) as f:
                parsed = json.load(f)
                fname = filename.lower()

                if "streaminghistory_podcast" in fname:
                    if isinstance(parsed, list):
                        valid = [entry for entry in parsed if "endTime" in entry and "msPlayed" in entry]
                        podcast_data.extend(valid)
                        
                    else:
                        logger.warning(f"{filename} no JSON array found.")
                elif "streaminghistory_music" in fname:
                    if isinstance(parsed, list):
                        valid = [entry for entry in parsed if "endTime" in entry and "msPlayed" in entry]
                        music_data.extend(valid)
                        
                    else:
                        logger.warning(f"{filename} no JSON array found.")
                elif "yourlibrary" in fname:
                    if isinstance(parsed, dict):
                        for section in ["artists", "shows"]:
                            if section in parsed and isinstance(parsed[section], list):
                                # Merge lists from multiple files instead of overwriting
                                library_data_raw.setdefault(section, []).extend(parsed[section])
                    else:
                        logger.warning(f"{filename} no JSON array found.")

        except Exception as e:
            error_msg = f"{key}: Error parsing {filename} - {e}"
            meta_data.append(("error", error_msg))
            logger.warning(error_msg)

    library_data = {
        "artists": [e for e in library_data_raw.get("artists", []) if isinstance(e, dict) and "name" in e],
        "shows": [e for e in library_data_raw.get("shows", []) if isinstance(e, dict) and "name" in e]
    }

    

    return podcast_data, music_data, library_data







def spotify_data_extraction(podcast_data, music_data, library_data) -> dict:
    """
    Transforms raw Spotify user data into structured Pandas DataFrames
    for streamlined processing, display, and donation.

    This function acts as a post-processing layer after the ZIP file has been
    parsed and categorized. It takes unstructured JSON-like lists and dictionaries
    and returns consistent, localized, user-readable tables ready for consent UI
    and downstream use.

    Args:
        podcast_data (list[dict]):
            A list of raw streaming history entries for podcasts, as parsed
            from "streaminghistory_podcast*" JSON files. Each entry typically
            contains fields like `endTime`, `msPlayed`, `podcastName`, and `episodeName`.

        music_data (list[dict]):
            A list of raw streaming history entries for music listening, typically
            containing fields like `endTime`, `msPlayed`, `artistName`, and `trackName`.

        library_data (dict):
            A dictionary representing followed Spotify content, typically sourced
            from a `yourlibrary` file. Expected keys:
                - `'artists'`: list of dicts with at least a `'name'`
                - `'shows'`: list of dicts with at least a `'name'`

    Returns:
        dict: A dictionary containing the following Pandas DataFrames:

            - `"podcast_df"`: Cleaned and enriched podcast stream history,
                including formatted timestamps, types, and durations.

            - `"music_df"`: Structured song listening data, processed similarly.

            - `"artists_df"`: A list of followed artists with a standardized schema.

            - `"shows_df"`: A list of followed podcast shows in the same format.

    Output Format:
    --------------
    For both `podcast_df` and `music_df`, the final schema is:
        - `Datum`: Listening date (DD-MM-YYYY)
        - `Uhrzeit`: Exact end time of stream
        - `Nummer`: Running index per row (1-based)
        - `Typ`: Either "Podcast" or "Song"
        - `Name`: Artist name (music) or podcast name (podcasts)
        - `Titel`: Episode or track title
        - `Hördauer(in Minuten)`: Duration in full minutes (rounded up)

    For `artists_df` and `shows_df`, the schema is:
        - `Name`: Name of the followed artist or show
        - `Typ`: Static label ("Artist" or "Podcast")

    Internal Details:
    -----------------
    - A nested helper function `extract_streaming_history()` standardizes
      streaming data formatting and sorting logic.
    - Missing or corrupt `endTime` entries are safely dropped during parsing.
    - Listening durations (`msPlayed`) are converted to full minutes using `ceil`.
    - Output DataFrames are guaranteed to have consistent columns, even if input
      data is missing or incomplete.

    Notes:
    ------
    - This function is intended to be pure and stateless. All logging and
      error handling should occur before or after this stage.
    - The resulting structure is designed for display in tables as part of
      user consent review.
    """
    def extract_streaming_history(df, typ, name_col, title_col):
        """
        Converts raw streaming history JSON data into a structured DataFrame.

        Args:
            df (pd.DataFrame): Raw streaming data.
            typ (str): Type label (Podcast/Song).
            name_col (str): Column with artist/show names.
            title_col (str): Column with track/episode titles.

        Returns:
            pd.DataFrame: Processed streaming data with formatted time and duration.
        """
        if df.empty:
            return pd.DataFrame(columns=["Datum", "Uhrzeit", "Nummer", "Typ", "Name", "Titel", "Hördauer(in Minuten)"])

        df = df.copy()
        df["endTime"] = pd.to_datetime(df["endTime"], errors="coerce")
        df = df.dropna(subset=["endTime"])
        df = df.sort_values(by="endTime").reset_index(drop=True)

        return pd.DataFrame({
            "Datum": df["endTime"].dt.strftime('%d-%m-%Y'),
            "Uhrzeit": df["endTime"],
            "Nummer": df.index + 1,
            "Typ": typ,
            "Name": df[name_col],
            "Titel": df[title_col],
            "Hördauer(in Minuten)": np.ceil(df["msPlayed"] / 60000).astype(int)
        })

    podcast_df = extract_streaming_history(pd.DataFrame(podcast_data), "Podcast", "podcastName", "episodeName")
    music_df = extract_streaming_history(pd.DataFrame(music_data), "Song", "artistName", "trackName")

    artists = pd.DataFrame([
        {"Name": e.get("name"), "Typ": "Artist"}
        for e in library_data.get("artists", [])
        if isinstance(e, dict) and "name" in e
    ])

    shows = pd.DataFrame([
        {"Name": e.get("name"), "Typ": "Podcast"}
        for e in library_data.get("shows", [])
        if isinstance(e, dict) and "name" in e
    ])

   

    data = {
            "podcast_df": podcast_df,
            "music_df": music_df,
            "artists_df": artists,
            "shows_df": shows
        }

    return data




def prompt_file(extensions):
    """
    Creates a UI component prompting the user to upload a file.

    Args:
        extensions (str): Allowed file MIME types (e.g., 'application/zip').

    Returns:
        PropsUIPromptFileInput: File input component for the UI.
    """
    description = props.Translatable({
        "en": "",
        "de": ""
    })
    return props.PropsUIPromptFileInput(description, extensions)


def prompt_extraction_message(message, percentage):
    """
    Generates a progress UI component showing extraction status.

    Args:
        message (str): Message to display (usually the filename).
        percentage (float): Progress as a percentage.

    Returns:
        PropsUIPromptProgress: Progress component with translated status message.
    """
    description = props.Translatable({
        "en": "Extracting your data...",
        "de": "Daten werden extrahiert..."
    })
    return props.PropsUIPromptProgress(description, message, percentage)




def retry_confirmation(text=None):
    """
    Prompts the user to either retry or exit the process.

    Returns:
        PropsUIPromptConfirm: UI prompt with 'Try again' and 'Exit' options.
    """
    if text is None:
        text = props.Translatable({
            "en": "It looks like you have selected the wrong file. Please check whether you have loaded the original ZIP file of your Spotify data export and then click on 'Try again' to load the correct file. Click on 'Exit' to return to the overview. There you can start a short survey - we look forward to your participation!",
            "de": 'Es sieht so aus, als hätten Sie eine falsche Datei ausgewählt. Bitte überprüfen Sie, ob Sie die originale ZIP-Datei Ihres Spotify-Datenexports geladen haben, und klicken Sie anschließend auf "Erneut versuchen", um die korrekte Datei zu laden. Mit einem Klick auf "Beenden" gelangen Sie zurück zur Übersicht. Dort können Sie die Kurzbefragung starten – wir würden uns sehr über Ihre Teilnahme freuen!'
        })

    try_again = props.Translatable({
        "en": "Try again",
        "de": "Erneut versuchen"
    })

    exit_prompt = props.Translatable({
        "en": "Exit",
        "de": "Beenden"
    })

    return props.PropsUIPromptConfirm(
        text=text,
        ok=try_again,
        cancel=exit_prompt
    )



def render_data_submission_page(body):
    """
    Wraps the UI content into a standard data submission page format.

    Args:
        body (list or PropsUIComponent): UI component(s) to render.

    Returns:
        CommandUIRender: Command to render the data submission page.
        
        
    """
    header = props.PropsUIHeader(props.Translatable({
        "en": "Spotify streaming behavior",
        "de": "Spotify-Streamingverhalten"
    }))
    body_items = [body] if not isinstance(body, list) else body
    page = props.PropsUIPageDataSubmission("Zip", header, body_items)
    return CommandUIRender(page)


def render_no_submission_page():
    header = props.PropsUIHeader(
        props.Translatable(
            {
            "en": "No Spotify Streaming Behaviour Data",
            "de": "Keine Spotify Streamingverlauf-Daten",
            }
        )
    )

    body = props.PropsUIPromptConfirm(
        text=props.Translatable({
            "en": "Your data package does not contain any Spotify Streaming Data. By clicking End, you can complete your study participation.",
            "de": 'Ihr Datenpaket enthält keine Daten zu Ihrem Hörverhalten auf Spotify. Mit einem Klick auf "Beenden" gelangen Sie zurück zur Übersicht. Dort können Sie die Kurzbefragung starten – wir würden uns sehr über Ihre Teilnahme freuen!',
            }
        ),
        ok= props.Translatable(
            {"en": "End", 
             "de": "Beenden"
            }
        ),  
    )

    page = props.PropsUIPageDataSubmission("NoSpotifyData", header, body)  
    return CommandUIRender(page)


def prompt_consent(data):
    """
    Presents the extracted and formatted Spotify data to the user and prompts them
    to consent to donate the data.

    This function creates a user interface consisting of two preview tables:
    - One showing followed artists and shows.
    - One showing the user's listening history (music and podcasts).

    Users are asked whether they would like to donate this data, and can choose to:
    - Confirm the donation (`PayloadJSON`)
    - Exit without donating (`PayloadTrue`)
    - Go back to review the data again (`PayloadFalse`)

    Args:
        data (dict): A dictionary containing pre-processed Spotify data as Pandas
                     DataFrames. Expected keys:
                        - "podcast_df": DataFrame with podcast streaming history.
                        - "music_df": DataFrame with music streaming history.
                        - "artists_df": Followed artists.
                        - "shows_df": Followed shows.

    Yields:
        CommandUIRender: UI instructions rendered to the frontend.
                         These guide the user through reviewing their data and making a consent decision.

    UI Composition:
    ----------------
    1. **Library Table** (`spotify_library_data`):
        - Combines `artists_df` and `shows_df` (if present) into a unified table.
        - Columns: `Typ` ("Artist"/"Podcast"), `Name` (Name of artist/show).

    2. **Stream History Table** (`spotify_stream_history`):
        - Merges `podcast_df` and `music_df` into a chronological DataFrame.
        - Columns include:
            - `Datum` (Listening date, dd-mm-yyyy)
            - `Uhrzeit` (Rounded hour timestamp)
            - `Nummer` (Sequential ID)
            - `Typ` (Song/Podcast)
            - `Name` (Artist or show name)
            - `Titel` (Track or episode name)
            - `Hördauer(in Minuten)` (Listening duration in minutes)

    3. **Formatting Logic**:
        - Dates are parsed and sorted in descending order.
        - Times are rounded to full hours using the `round_hour()` helper.
        - The stream table is sorted first by date, then by hour.
        - Empty data tables are gracefully handled.

    4. **Fallback**:
        - If both stream and library data are empty, the user is shown a message
          indicating that no data could be extracted. No donation is solicited.

    5. **Consent Decision**:
        - If the user confirms donation (`PayloadJSON`), the result is returned to
          be handled by the `process()` function.
        - If the user selects "Exit" (`PayloadTrue`), they are taken out of the flow.
        - If the user selects "Back" (`PayloadFalse`), they are shown the tables again.

    Notes:
    ------
    - The function assumes the DataFrames have already been pre-cleaned and
      follow the expected schema.
    - All text content and headers are multilingual (English and German).
    - This function plays a critical role in informed user consent, providing
      full transparency into what data will be shared.
    """
    artists_df = data.get("artists_df", pd.DataFrame())
    shows_df = data.get("shows_df", pd.DataFrame())

    dfs = []
    if "Typ" in artists_df.columns and "Name" in artists_df.columns:
        dfs.append(artists_df[["Typ", "Name"]])
    if "Typ" in shows_df.columns and "Name" in shows_df.columns:
        dfs.append(shows_df[["Typ", "Name"]])
    library_df = pd.concat(dfs, ignore_index=True).drop_duplicates(subset=["Typ", "Name"]) if dfs else pd.DataFrame(columns=["Typ", "Name"])


    podcast_df = data.get("podcast_df", pd.DataFrame())
    music_df = data.get("music_df", pd.DataFrame())

    stream_df = pd.concat([podcast_df, music_df], ignore_index=True)
    stream_df = stream_df[["Datum", "Uhrzeit", "Nummer", "Typ", "Name", "Titel", "Hördauer(in Minuten)"]]
    
    stream_df["Datum_sortierbar"] = pd.to_datetime(stream_df["Datum"], format="%d-%m-%Y", errors="coerce")
    stream_df = stream_df.sort_values(by=["Datum_sortierbar", "Uhrzeit"], ascending=[False, True]).reset_index(drop=True)
    stream_df = stream_df.drop(columns=["Datum_sortierbar"])
    

    def round_hour(t):
        rounded = (t + pd.Timedelta(hours=1)).replace(minute=0, second=0, microsecond=0) \
            if t.minute or t.second or t.microsecond else \
            t.replace(minute=0, second=0, microsecond=0)
        return rounded.strftime('%H:%M')

    stream_df["Nummer"] = range(1, len(stream_df) + 1)
    stream_df["Uhrzeit"] = stream_df["Uhrzeit"].apply(round_hour)

    if stream_df.empty and library_df.empty:
        yield render_data_submission_page(
            props.PropsUIPromptText(
                text=props.Translatable({
                    "en": "No Spotify data could be extracted.",
                    "de": "Es konnten keine Spotify-Daten extrahiert werden."
                })
            )
        )
        return

    library_table = props.PropsUIPromptConsentFormTable(
        "spotify_library_data", 1,
        props.Translatable({"en": "Followed Content", "de": "Gefolgt"}),
        props.Translatable({"en": "Artists and Shows you follow.", "de": "Künstler und Shows, denen Sie folgen."}),
        library_df,
        headers={
            "Typ": props.Translatable({"en": "Type", "de": "Typ"}),
            "Name": props.Translatable({"en": "Name", "de": "Name"})
        }
    )

    stream_table = props.PropsUIPromptConsentFormTable(
        "spotify_stream_history", 2,
        props.Translatable({"en": "Stream History", "de": "Streaming-Verlauf"}),
        props.Translatable({"en": "Podcasts and songs you listened to.", "de": "Podcasts und Songs, die Sie gehört haben."}),
        stream_df,
        headers={
            "Datum": props.Translatable({"en": "Date", "de": "Datum"}),
            "Uhrzeit": props.Translatable({"en": "Hour", "de": "Uhrzeit"}),
            "Nummer": props.Translatable({"en": "No.", "de": "Nr."}),
            "Typ": props.Translatable({"en": "Type", "de": "Typ"}),
            "Name": props.Translatable({"en": "Name", "de": "Name"}),
            "Titel": props.Translatable({"en": "Title", "de": "Titel"}),
            "Hördauer(in Minuten)": props.Translatable({"en": "Duration (Min)", "de": "Dauer (Min)"})
        }
    )

    result = yield render_data_submission_page([
        library_table,
        stream_table,
        props.PropsUIDataSubmissionButtons(
            donate_question=props.Translatable({
                "en": "Would you like to donate this data?",
                "de": "Möchten Sie diese Daten spenden?"
            }),
            donate_button=props.Translatable({"en": "Donate", "de": "Spenden"}))
        
    ])

    if result.__type__ == "PayloadJSON":
        return result

    confirm = yield render_data_submission_page(props.PropsUIPromptConfirm(
        text=props.Translatable({
            "en": "Do you want to exit without donating? Click on 'Exit' to return to the overview. There you can start a short survey - we look forward to your participation!",
            "de": 'Möchten Sie den Prozess ohne Spende beenden? Mit einem Klick auf "Beenden" gelangen Sie zurück zur Übersicht. Dort können Sie die Kurzbefragung starten – wir würden uns sehr über Ihre Teilnahme freuen!'
        }),
        ok=props.Translatable({"en": "Exit", "de": "Beenden"}),
        cancel=props.Translatable({"en": "Back", "de": "Zurück"})
    ))

    return confirm



def donate(key, json_string):
    """
    Sends the data donation payload to the system backend.

    Args:
        key (str): Unique identifier for the submission.
        json_string (str): JSON-formatted donation data.

    Returns:
        CommandSystemDonate: Donation command to send to backend.
    """
    return CommandSystemDonate(key, json_string)


def exit(code, info):
    """
    Issues a command to terminate the process early.

    Args:
        code (int): Exit code.
        info (str): Optional message or reason.

    Returns:
        CommandSystemExit: Command to gracefully exit the process.
    """
    return CommandSystemExit(code, info)


class NotAZipFileError(Exception):
    # Raised when the uploaded file is not a ZIP archive.
    pass

class InvalidSpotifyZipError(Exception):
    # Raised when expected Spotify files are missing.
    pass

class EmptySpotifyZipError(Exception):
    # Raised when the archive contains no streaming or library data.
    pass

