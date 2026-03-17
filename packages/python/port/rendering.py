import port.api.props as props
from port.api.assets import *
from port.api.commands import CommandUIRender

import pandas as pd


class PageRenderer:

    def render_page(self, body):
        header = props.PropsUIHeader(
            props.Translatable(
                {
                    "en": "Youtube Data donation",
                    "de": "Youtube-Datenspende",
                    "it": "Donazione dati Youtube",
                    "es": "Donación de datos de Youtube",
                    "nl": "Youtube-datadonatie",
                }
            )
        )
        page = props.PropsUIPageDataSubmission("Zip", header, body)
        return CommandUIRender(page)

    def retry_confirmation_page(self, error_message=""):
        text = props.Translatable(
            {
                "en": f"Unfortunately, we cannot process your file. Continue, if you are sure that you selected the right file. Try again to select a different file. ({error_message})",
                "de": f"Leider können wir Ihre Datei nicht bearbeiten. Fahren Sie fort, wenn Sie sicher sind, dass Sie die richtige Datei ausgewählt haben. Versuchen Sie, eine andere Datei auszuwählen. ({error_message})",
                "it": f"Purtroppo non possiamo elaborare il tuo file. Continua se sei sicuro di aver selezionato il file corretto. Prova a selezionare un file diverso. ({error_message})",
                "es": f"Lamentablemente, no podemos procesar su archivo. Continúe si está seguro de que ha seleccionado el archivo correcto. Intente seleccionar un archivo diferente. ({error_message})",
                "nl": f"Helaas, kunnen we uw bestand niet verwerken. Weet u zeker dat u het juiste bestand heeft gekozen? Ga dan verder. Probeer opnieuw als u een ander bestand wilt kiezen. ({error_message})",
            }
        )
        ok = props.Translatable(
            {
                "en": "Try again",
                "de": "Erneut versuchen",
                "it": "Riprova",
                "es": "Inténtelo de nuevo",
                "nl": "Probeer opnieuw",
            }
        )
        cancel = props.Translatable(
            {
                "en": "Continue",
                "de": "Weiter",
                "it": "Continua",
                "es": "Continuar",
                "nl": "Verder",
            }
        )
        return self.render_page([props.PropsUIPromptConfirm(text, ok, cancel)])

    def prompt_file_page(self, extensions):
        description = props.Translatable(
            {
                "en": f"Pick the file that you received from Youtube. In the next step, the data that is required for research is extracted from your file. This may take a while, thank you for your patience.",
                "de": f"Wählen Sie die Datei aus, die Sie von Youtube erhalten haben. Im nächsten Schritt werden die für die Forschung benötigten Daten aus Ihrer Datei extrahiert. Dies kann einige Zeit in Anspruch nehmen – vielen Dank für Ihre Geduld.",
                "it": f"Seleziona il file che hai ricevuto da Youtube. Nel passaggio successivo, i dati richiesti per la ricerca verranno estratti dal tuo file. Questo potrebbe richiedere un po’ di tempo, grazie per la pazienza.",
                "nl": f"Klik op ‘Kies bestand’ om het bestand dat u van Youtube ontvangen hebt te kiezen. Als u op 'Verder' klikt worden de gegevens die nodig zijn voor het onderzoek uit uw bestand gehaald. Dit kan soms even duren. Een moment geduld a.u.b.",
            }
        )

        return self.render_page([props.PropsUIPromptFileInput(description, extensions)])

    def prompt_extraction_message_page(self, message, percentage):
        description = props.Translatable(
            {
                "en": "One moment please. Information is now being extracted from the selected file.",
                "de": "Einen Moment bitte. Es werden nun Informationen aus der ausgewählten Datei extrahiert.",
                "it": "Un momento, per favore. Le informazioni vengono estratte dal file selezionato.",
                "es": "Un momento, por favor. Se están extrayendo los datos del archivo seleccionado.",
                "nl": "Een moment geduld. Informatie wordt op dit moment uit het geselecteerde bestaand gehaald.",
            }
        )

        return self.render_page(
            [props.PropsUIPromptProgress(description, message, percentage)]
        )

    def prompt_consent_generator(
        self, search_history=[], search_watch_history=[], watch_history=[], subscriptions=[], videos=[]
    ):
        description = props.PropsUIPromptText(
            text=props.Translatable(
                {
                    "en": "Please review your data below. Use the search fields to find specific information. You can remove any data you prefer not to share. Thank you for supporting this research project!",
                    "de": "Bitte überprüfen Sie Ihre Daten unten. Verwenden Sie die Suchfelder, um bestimmte Informationen zu finden. Sie können alle Daten entfernen, die Sie nicht teilen möchten. Vielen Dank für Ihre Unterstützung dieses Forschungsprojekts!",
                    "it": "Controlla i tuoi dati qui sotto. Usa i campi di ricerca per trovare informazioni specifiche. Puoi rimuovere qualsiasi dato che preferisci non condividere. Grazie per il tuo supporto a questo progetto di ricerca!",
                    "es": "Revise sus datos a continuación. Utilice los campos de búsqueda para encontrar información específica. Puede eliminar cualquier dato que prefiera no compartir. ¡Gracias por apoyar este proyecto de investigación!",
                    "nl": "Bekijk hieronder uw gegevens. Gebruik de zoekvelden om specifieke informatie te vinden. U kunt gegevens verwijderen die u liever niet deelt. Bedankt voor uw steun aan dit onderzoeksproject!",
                }
            )
        )

        headers = {
            "title": props.Translatable(
                {
                    "en": "Title",
                    "de": "Titel",
                    "it": "Titolo",
                    "es": "Título",
                    "nl": "Titel",
                }
            ),
            "titleUrl": props.Translatable(
                {
                    "en": "URL",
                    "de": "URL",
                    "it": "URL",
                    "es": "URL",
                    "nl": "URL",
                }
            ),
            "time": props.Translatable(
                {
                    "en": "Time",
                    "de": "Zeit",
                    "it": "Ora",
                    "es": "Hora",
                    "nl": "Tijd",
                }
            ),
        }

        table_description = props.Translatable(
            {
                "en": "The table below shows the contents of the zip file you selected.",
                "de": "Die Tabelle unten zeigt den Inhalt der ZIP-Datei, die Sie gewählt haben.",
                "it": "La tabella qui sotto mostra il contenuto del file ZIP che ha scelto.",
                "es": "La tabla a continuación muestra el contenido del archivo ZIP que ha seleccionado.",
                "nl": "De tabel hieronder laat de inhoud zien van het zip-bestand dat u heeft gekozen.",
            }
        )

        # Show data table if extracted data is available
        search_data_table = None
        if len(search_history) > 0:
            data_frame = pd.DataFrame(
                search_history, columns=["title", "titleUrl", "time"]
            )
            search_data_table = props.PropsUIPromptConsentFormTable(
                "search_data",
                1,
                props.Translatable(
                    {
                        "en": "Search history data",
                        "de": "Suchverlauf-Daten",
                        "it": "Dati della cronologia delle ricerche",
                        "es": "Datos del historial de búsquedas",
                        "nl": "Gegevens zoekgeschiedenis",
                    }
                ),
                table_description,
                data_frame,
                5000,
                headers,
            )

        # Show data table if extracted data is available
        search_watch_data_table = None
        if len(search_watch_history) > 0:
            data_frame = pd.DataFrame(
                search_watch_history, columns=["title", "titleUrl", "time"]
            )
            search_watch_data_table = props.PropsUIPromptConsentFormTable(
                "search_data",
                2,
                props.Translatable(
                    {
                        "en": "Search-watch history data",
                        "de": "Suchsehverlauf-Daten",
                        "it": "Dati della cronologia delle ricerche-visualizzazioni",
                        "es": "Datos del historial de búsquedas-reproducciones",
                        "nl": "Gegevens zoek-kijkgeschiedenis",
                    }
                ),
                table_description,
                data_frame,
                5000,
                headers,
            )

        # Show data table if extracted data is available
        watch_data_table = None
        if len(watch_history) > 0:
            data_frame = pd.DataFrame(
                watch_history, columns=["title", "titleUrl", "time"]
            )

            watch_data_table = props.PropsUIPromptConsentFormTable(
                "watch_data",
                3,
                props.Translatable(
                    {
                        "en": "Watch history data",
                        "de": "Sehverlauf-Daten",
                        "it": "Dati della cronologia delle visualizzazioni",
                        "es": "Datos del historial de reproducciones",
                        "nl": "Gegevens kijkgeschiedenis",
                    }
                ),
                table_description,
                data_frame,
                5000,
                headers,
            )

        subscriptions_headers = {
            "channel_url": props.Translatable(
                {
                    "en": "Channel URL",
                    "de": "Kanal-URL",
                    "it": "URL canale",
                    "es": "URL de canal",
                    "nl": "Kanaal-URL",
                }
            ),
            "channel_title": props.Translatable(
                {
                    "en": "Channel Title",
                    "de": "Kanaltitel",
                    "it": "Titolo canale",
                    "es": "Título del canal",
                    "nl": "Kanaaltitel",
                }
            ),
        }

        subscriptions_table = None
        if len(subscriptions) > 0:
            data_frame = pd.DataFrame(
                subscriptions, columns=["channel_title", "channel_url"]
            )
            subscriptions_table = props.PropsUIPromptConsentFormTable(
                "subscriptions_data",
                4,
                props.Translatable(
                    {
                        "en": "Subscriptions data",
                        "de": "Abonnement-Daten",
                        "it": "Dati sugli abbonamenti",
                        "es": "Datos de suscripciones",
                        "nl": "Abonnementgegevens",
                    }
                ),
                table_description,
                data_frame,
                5000,
                subscriptions_headers,
            )

        videos_headers = {
            "video_publish_timestamp": props.Translatable(
                {
                    "en": "Published on",
                    "de": "Veröffentlicht am",
                    "it": "Pubblicato il",
                    "es": "Publicado el",
                    "nl": "Gepubliceerd op",
                }
            ),
            "video_title": props.Translatable(
                {
                    "en": "Title",
                    "de": "Titel",
                    "it": "Titolo",
                    "es": "Título",
                    "nl": "Titel",
                }
            ),
            "video_category": props.Translatable(
                {
                    "en": "Category",
                    "de": "Kategorie",
                    "it": "Categoria",
                    "es": "Categoría",
                    "nl": "Categorie",
                }
            ),
            "privacy": props.Translatable(
                {
                    "en": "Privacy",
                    "de": "Datenschutz",
                    "it": "Privacy",
                    "es": "Privacidad",
                    "nl": "Privacy",
                }
            ),
        }

        videos_table = None
        if len(videos) > 0:
            data_frame = pd.DataFrame(
                videos,
                columns=["video_publish_timestamp", "video_title", "video_category", "privacy"],
            )
            videos_table = props.PropsUIPromptConsentFormTable(
                "videos_data",
                5,
                props.Translatable(
                    {
                        "en": "Uploaded videos data",
                        "de": "Hochgeladene Videos",
                        "it": "Dati dei video caricati",
                        "es": "Datos de videos subidos",
                        "nl": "Geüploade video's",
                    }
                ),
                table_description,
                data_frame,
                5000,
                videos_headers,
            )

        # Construct and render the final consent page
        result = yield self.render_page(
            [
                item
                for item in [
                    description,
                    search_data_table,
                    search_watch_data_table,
                    watch_data_table,
                    subscriptions_table,
                    videos_table,
                    props.PropsUIDataSubmissionButtons(
                        donate_question=props.Translatable(
                            {
                                "en": "Would you like to donate the above data?",
                                "de": "Möchten Sie die obenstehenden Daten spenden?",
                                "it": "Vuoi donare i dati sopra indicati?",
                                "es": "¿Le gustaría donar los datos anteriores?",
                                "nl": "Wilt u de bovenstaande gegevens doneren?",
                            }
                        ),
                        donate_button=props.Translatable(
                            {
                                "en": "Yes, donate",
                                "de": "Ja, spenden",
                                "it": "Sì, dona",
                                "es": "Sí, donar",
                                "nl": "Ja, doneer",
                            }
                        ),
                    ),
                ]
                if item is not None
            ]
        )
        return result
