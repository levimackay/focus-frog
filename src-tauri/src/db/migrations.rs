//! Embedded SQL migrations, applied once at startup via a `PRAGMA
//! user_version` check. Add new migrations by appending to this list and
//! bumping their index -- never edit an already-shipped migration file.

use rusqlite::{Connection, Result as SqlResult};

/// Ordered list of migrations. Index 0 brings a fresh database from
/// `user_version = 0` to `user_version = 1`, and so on.
const MIGRATIONS: &[&str] = &[include_str!("migrations/0001_init.sql")];

pub fn run(conn: &mut Connection) -> SqlResult<()> {
    let current_version: i64 = conn.query_row("PRAGMA user_version", [], |row| row.get(0))?;
    let current_version = current_version.max(0) as usize;

    if current_version >= MIGRATIONS.len() {
        return Ok(());
    }

    for (idx, migration) in MIGRATIONS.iter().enumerate().skip(current_version) {
        let tx = conn.transaction()?;
        tx.execute_batch(migration)?;
        let new_version = idx as i64 + 1;
        tx.pragma_update(None, "user_version", new_version)?;
        tx.commit()?;
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn migrations_run_cleanly_on_a_fresh_database() {
        let mut conn = Connection::open_in_memory().unwrap();
        run(&mut conn).unwrap();

        let version: i64 = conn
            .query_row("PRAGMA user_version", [], |row| row.get(0))
            .unwrap();
        assert_eq!(version, MIGRATIONS.len() as i64);

        let table_count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(table_count, 7);
    }

    #[test]
    fn migrations_are_idempotent_when_run_twice() {
        let mut conn = Connection::open_in_memory().unwrap();
        run(&mut conn).unwrap();
        // Running again against an already-migrated database must not
        // error (e.g. from re-issuing CREATE TABLE).
        run(&mut conn).unwrap();
    }
}
