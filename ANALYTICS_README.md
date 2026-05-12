# Firebase Analytics Events

This project uses Firebase Analytics through [`firebaseAnalytics.js`](/Users/mitesh/Desktop/zinc-housing/firebaseAnalytics.js) and `.env` configuration.

## Environment Variables

These variables are used from `.env`:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_MEASUREMENT_ID`
- `VITE_FIREBASE_DEBUG`

## Event List

1. `page_view`
- Trigger: page load in `index`, `planner`, `location`, and `results`.
- Params: `page_title`, `page_location`, `page_path`, `page_name`.

2. `button_click`
- Trigger: all button clicks in `results`, plus key button clicks in `index`, `planner`, `location`.
- Params: `button_name`, `page_path`, optional contextual fields (example: `city`).

3. `value_submit`
- Trigger: submit/save actions where user values are applied.
- Places:
- `index`: user profile continue/skip (`email_provided`, `phone_provided`)
- `planner`: house value proceed (`house_value_submit`)
- `location`: city proceed (`city_submit`)
- `results`: loan settings save, construction settings save, assumptions save, house value edit save
- Params: `action_name`, `submitted_value`, `page_path`, and action-specific fields.

## Files Updated

- [`firebaseAnalytics.js`](/Users/mitesh/Desktop/zinc-housing/firebaseAnalytics.js)
- [`index.js`](/Users/mitesh/Desktop/zinc-housing/index.js)
- [`index.html`](/Users/mitesh/Desktop/zinc-housing/index.html)
- [`planner-main.js`](/Users/mitesh/Desktop/zinc-housing/planner-main.js)
- [`location.js`](/Users/mitesh/Desktop/zinc-housing/location.js)
- [`results.js`](/Users/mitesh/Desktop/zinc-housing/results.js)
- [`.env`](/Users/mitesh/Desktop/zinc-housing/.env)
