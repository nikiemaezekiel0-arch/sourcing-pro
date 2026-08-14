const fs = require('fs');
let code = fs.readFileSync('js/admin.js', 'utf8');

const newCode = `
// ==========================================
// TEAM MANAGEMENT LOGIC (ADMIN)
// ==========================================

function renderAdminTeam() {
    const db = getDB();
    const list = document.getElementById('admin-team-list');
    if(!list) return;
    
    // Find all users who are not normal clients or suppliers (or find all users and we can change their role)
    // Actually, to add a staff, the admin should be able to see ALL users and change their role to staff.
    // BUT we only want to show staff here. So we show staff, AND a select box to add a new one from clients.
    
    const staffMembers = (db.users || []).filter(u => u.role === 'staff_sales' || u.role === 'admin');
    const clients = (db.users || []).filter(u => u.role === 'client' && u.status === 'active');
    
    let html = '';
    
    // Add new staff form
    html += \`
    <div class="glass-panel mb-6" style="padding: 1.5rem; border: 1px solid var(--primary);">
        <h4 class="mb-3">Ajouter un collaborateur</h4>
        <div class="flex gap-2" style="flex-wrap: wrap;">
            <select id="team-new-member" class="input-field" style="flex: 1; min-width: 200px;">
                <option value="">-- Sélectionner un client existant --</option>
                \${clients.map(c => \`<option value="\${c.id}">\${c.name} (\${c.email})</option>\`).join('')}
            </select>
            <select id="team-new-role" class="input-field" style="width: 200px;">
                <option value="staff_sales">Chargé(e) de Vente</option>
                <option value="admin">Administrateur</option>
            </select>
            <button class="btn-primary" onclick="addTeamMember()">Ajouter à l'équipe</button>
        </div>
    </div>
    \`;
    
    // List staff
    staffMembers.forEach(staff => {
        const isAdmin = staff.role === 'admin';
        const roleLabel = isAdmin ? 'Administrateur' : 'Chargé(e) de Vente';
        const badgeColor = isAdmin ? 'var(--danger)' : 'var(--primary)';
        
        html += \`
        <div class="glass-panel flex justify-between items-center" style="padding: 1rem 1.5rem;">
            <div>
                <h4 style="margin: 0 0 5px 0;">\${staff.name}</h4>
                <div class="text-muted text-sm">\${staff.email}</div>
            </div>
            <div class="flex items-center gap-4">
                <span class="badge" style="background: \${badgeColor};">\${roleLabel}</span>
                \${!isAdmin ? \`<button class="btn-secondary text-sm" onclick="removeTeamMember('\${staff.id}')">Retirer l'accès</button>\` : ''}
            </div>
        </div>
        \`;
    });
    
    list.innerHTML = html;
}

async function addTeamMember() {
    const userId = document.getElementById('team-new-member').value;
    const role = document.getElementById('team-new-role').value;
    
    if(!userId) return alert("Veuillez sélectionner un utilisateur.");
    
    const db = getDB();
    const user = db.users.find(u => u.id === userId);
    if(!user) return;
    
    if(!confirm(\`Êtes-vous sûr de vouloir donner le rôle \${role === 'admin' ? 'Administrateur' : 'Chargé(e) de Vente'} à \${user.name} ?\`)) return;
    
    user.role = role;
    
    try {
        await saveDoc('users', user);
        showNotification(user.name + " a été ajouté à l'équipe !", "success");
        renderAdminTeam();
    } catch(err) {
        console.error(err);
        alert("Erreur: " + err.message);
    }
}

async function removeTeamMember(userId) {
    if(!confirm("Voulez-vous vraiment retirer l'accès à ce collaborateur ? Il redeviendra un client normal.")) return;
    
    const db = getDB();
    const user = db.users.find(u => u.id === userId);
    if(!user) return;
    
    user.role = 'client';
    
    try {
        await saveDoc('users', user);
        showNotification(user.name + " a été retiré de l'équipe.", "success");
        renderAdminTeam();
    } catch(err) {
        console.error(err);
        alert("Erreur: " + err.message);
    }
}
`;

fs.writeFileSync('js/admin.js', code + "\n" + newCode);
console.log("Appended Team Logic");
