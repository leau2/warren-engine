# 🚀 DÉPLOIEMENT WARREN ENGINE - GUIDE COMPLET

## ✅ Ce repo est optimisé pour Vercel !

---

## 📋 ÉTAPES DE DÉPLOIEMENT

### 1. Fork ce repo (ou créez le vôtre)

**Sur GitHub :**
- Créez un nouveau repo : `warren-engine-final`
- Public
- Initialisez avec un README

---

### 2. Uploadez les fichiers

**Méthode facile (via interface GitHub) :**
1. Téléchargez ce dossier en ZIP
2. Décompressez
3. Sur GitHub, cliquez "Add file" → "Upload files"
4. Glissez tous les fichiers
5. Commit

**Méthode Git (via CMD) :**
```bash
git clone https://github.com/VOTRE_NOM/warren-engine-final.git
cd warren-engine-final
# Copiez tous les fichiers de ce dossier ici
git add .
git commit -m "Warren Engine"
git push
```

---

### 3. Déployer sur Vercel

**Allez sur** : https://vercel.com/new

1. **Importez votre repo GitHub**
2. **Configuration (auto-détectée) :**
   - Framework: Vite ✅
   - Build Command: `npm run build` ✅
   - Output Directory: `dist` ✅
3. **Cliquez "Deploy"**

**C'EST TOUT ! ⚡**

En 2 minutes, c'est en ligne !

---

## 🔑 Changer la clé API

**Fichier** : `src/App.jsx` (ligne 5)

```javascript
const [apiKey, setApiKey] = useState('VOTRE_CLE_ICI');
```

Changez la clé, commit, Vercel redéploie automatiquement !

---

## ✅ Testé et validé

Ce repo a été testé et fonctionne sur Vercel sans problème de permissions !

---

**Questions ?** Regardez le README.md principal.
