# Home assets

An installable web app (PWA) to track everything you own. Data syncs through your own Firebase project, so the same Google account sees the same assets on every phone.

## What it does
- Assets have a name, brand, photo, purchase date, price per unit, quantity, warranty date, notes, and a status.
- Each asset can have a **Location** (Kitchen), a **Parent** (a collection like Electronics), both, or neither. You create all of them yourself, and both can nest as deep as you like.
- **Retired** assets (disposed, sold, donated, broken, lost) stay in your list in a different color, sit at the bottom, and are never counted in value.
- Sort by price or purchase date. Retired items always stay at the bottom.
- Total value = price per unit × quantity, for active assets only.

## Set up (about 10 minutes)

1. **Firebase project.** At console.firebase.google.com, create a project. Add a **Web app** (the `</>` icon) and copy the config values.
2. **Paste the config** into `firebase-config.js`.
3. **Sign-in.** Build > Authentication > Get started > Sign-in method > enable **Google**.
4. **Database.** Build > Firestore Database > Create database (production mode). Open the **Rules** tab, paste the contents of `firestore.rules`, and publish.
5. **GitHub.** Create a repository, upload all these files to the root, then Settings > Pages > deploy from branch `main`, folder `/ (root)`.
6. **Allow your site to sign in.** Authentication > Settings > Authorized domains > add `YOUR-USERNAME.github.io`.
7. **Install on your phone.** Open `https://YOUR-USERNAME.github.io/REPO-NAME/`.
   iPhone: Share > Add to Home Screen. Android: browser menu > Install app.

## Notes
- Photos are shrunk on the phone and stored in Firestore, so you do not need Firebase Storage or a paid plan.
- The app works offline and syncs when you are back online.
- Settings > Export backup downloads a JSON copy of your data.
- `node test.mjs` runs the logic tests (sorting, totals, retired handling).
