with open("index.html", "r") as f:
    lines = f.readlines()

new_lines = []
in_client_trainings = False
in_admin_trainings = False

for i in range(len(lines)):
    line = lines[i]
    
    if '<div id="client-view-trainings" class="hidden">' in line:
        in_client_trainings = True
        new_lines.append("""                <!-- Trainings View -->
                <div id="client-view-trainings" class="hidden">
                    <div id="client-training-container" class="glass-panel" style="max-width: 600px; margin: 0 auto; text-align: center; padding: 3rem 2rem;">
                        <span class="material-icons-round animate-spin" style="font-size: 3rem; color: var(--accent-gold);">sync</span>
                        <p class="mt-4">Chargement de la formation...</p>
                    </div>
                </div>

                <!-- Ebooks Subview -->
                <div id="client-view-ebooks" class="hidden">
                    <div id="client-ebook-container" class="glass-panel" style="max-width: 600px; margin: 0 auto; text-align: center; padding: 3rem 2rem;">
                        <span class="material-icons-round animate-spin" style="font-size: 3rem; color: var(--accent-gold);">sync</span>
                        <p class="mt-4">Chargement de l'E-book...</p>
                    </div>
                </div>
""")
        continue
        
    if in_client_trainings:
        if '<!-- Boutique E-commerce View -->' in line:
            in_client_trainings = False
            # Append the current line
            new_lines.append(line)
        continue

    if '<div id="admin-view-trainings" class="hidden">' in line:
        in_admin_trainings = True
        new_lines.append("""                <!-- Trainings & E-books View -->
                <div id="admin-view-trainings" class="hidden">
                    <h3 class="mb-4 flex items-center gap-2"><span class="material-icons-round text-primary">school</span> Contenus & Formations</h3>
                    <div class="grid-layout" style="grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 2rem;">
                        <!-- Configuration Formation Principale -->
                        <div class="glass-panel">
                            <h3 class="mb-4 text-primary flex items-center gap-2"><span class="material-icons-round">play_lesson</span> Formation Principale</h3>
                            <p class="text-sm text-muted mb-4">Définissez l'image de présentation et le lien secret d'accès à la plateforme de formation.</p>
                            <form onsubmit="saveTrainingConfig(event)">
                                <div class="form-group">
                                    <label>URL de l'image de présentation</label>
                                    <input type="url" id="config-training-img" class="input-control" placeholder="https://..." required>
                                </div>
                                <div class="form-group">
                                    <label>Lien d'accès secret</label>
                                    <input type="url" id="config-training-link" class="input-control" placeholder="https://..." required>
                                    <small class="text-muted mt-1 inline-block">Ce lien ne sera dévoilé au client qu'après clic sur le bouton de réclamation.</small>
                                </div>
                                <button type="submit" class="btn-primary w-full" style="justify-content:center;">
                                    <span class="material-icons-round">save</span> Enregistrer Formation
                                </button>
                            </form>
                        </div>
                        <!-- Configuration E-Books -->
                        <div class="glass-panel">
                            <h3 class="mb-4 text-warning flex items-center gap-2"><span class="material-icons-round">menu_book</span> Gestion de l'E-book</h3>
                            <p class="text-sm text-muted mb-4">L'e-book unique affiché dans l'onglet E-books pour les clients Premium/VIP.</p>
                            <form onsubmit="saveEbookConfig(event)">
                                <div class="form-group">
                                    <label>Titre de l'E-book</label>
                                    <input type="text" id="config-ebook-title" class="input-control" placeholder="Titre..." required>
                                </div>
                                <div class="form-group">
                                    <label>URL de l'image de couverture</label>
                                    <input type="url" id="config-ebook-img" class="input-control" placeholder="https://..." required>
                                </div>
                                <div class="form-group">
                                    <label>Lien de téléchargement</label>
                                    <input type="url" id="config-ebook-link" class="input-control" placeholder="https://drive.google.com/..." required>
                                </div>
                                <button type="submit" class="btn-primary w-full" style="background: var(--accent-gold); color: black; justify-content:center;">
                                    <span class="material-icons-round">save</span> Enregistrer E-book
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
                <!-- Settings / Packs View -->
                <div id="admin-view-settings" class="hidden">
                    <h3 class="mb-4 flex items-center gap-2"><span class="material-icons-round text-primary">settings</span> Paramètres des Packs d'Accès</h3>
                    <p class="text-muted mb-6">Cochez les onglets que chaque pack débloque dans l'espace client. Les modifications s'appliquent en temps réel.</p>
                    <div class="glass-panel mb-6">
                        <form onsubmit="savePackSettings(event)">
                            <div class="overflow-x-auto">
                                <table class="table w-full">
                                    <thead>
                                        <tr>
                                            <th>Onglet (Fonctionnalité)</th>
                                            <th class="text-center">Fournisseur</th>
                                            <th class="text-center">Standard</th>
                                            <th class="text-center">Premium</th>
                                            <th class="text-center">VIP</th>
                                        </tr>
                                    </thead>
                                    <tbody id="pack-settings-tbody">
                                    </tbody>
                                </table>
                            </div>
                            <div class="mt-6 flex justify-end">
                                <button type="submit" class="btn-primary">
                                    <span class="material-icons-round">save</span> Sauvegarder les permissions
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
""")
        continue

    if in_admin_trainings:
        if '<!-- Agent d' in line:
            in_admin_trainings = False
            new_lines.append(line)
        continue

    new_lines.append(line)

with open("index.html", "w") as f:
    f.writelines(new_lines)

