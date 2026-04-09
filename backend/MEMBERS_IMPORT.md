# Members CSV Import

## Template

Use the template **`members_import_template.csv`** in this directory. It has exactly the columns the importer accepts:

| Column       | Required | Description |
|-------------|----------|-------------|
| First Name  | **Yes** | Column must appear in the header; given name |
| Last Name   | **Yes** | Column must appear in the header; family name |
| Email       | **Yes** | Must be valid; used to match or create the user |
| Nickname    | No       | Display name in the org (e.g. "JD" for Jane Doe) |
| Position    | No       | Role/title in the org (e.g. "Treasurer", "Secretary") |

**Optional:** You can add a **Role** column with values `admin`, `member`, or `restricted`. If omitted, new members are added as `member`.

- Header row is required; column names are case-insensitive.
- **Column order is required:** column 1 must be `First Name`, and column 2 must be `Last Name`.
- File must be UTF-8 encoded and use `.csv` extension.

## What happens once the CSV is imported?

1. **Validation**  
   Each row is validated. Rows without a valid email are skipped and reported in the response.

2. **User account**  
   - If a user with that email **already exists**: their name is updated from First/Last name only if their current name is empty.  
   - If **no user exists**: a new user is created with that email, a generated name (First + Last or email), and a random temporary password (they will need to use “Forgot password” or be invited to set one).

3. **Organization membership**  
   - If the person is **already a member** of this organization, the row is skipped as a duplicate.  
   - Otherwise, a **new membership** is created with:
     - **Status: pending** (they must be approved by an admin/owner before full access).
     - **Role**: from the CSV “Role” column, or `member` if omitted.
     - **Nickname** and **Position** (title) from the CSV, if provided.

4. **After import**  
   - Pending members appear in your organization’s member list (e.g. under “Pending” or “Awaiting approval”).  
   - An admin or owner can **approve** them so they get full access.  
   - New users can sign in with their email and use “Forgot password” to set a password, or you can invite them through your normal process.

No invitation emails are sent automatically by the import; approval and onboarding are done in the app or by your own process.
