pub mod migrations;
pub mod repository;

use std::path::Path;

use r2d2::Pool;
use r2d2_sqlite::SqliteConnectionManager;
use serde::Serialize;
use thiserror::Error;

pub type SqlitePool = Pool<SqliteConnectionManager>;

#[derive(Debug, Error, Serialize)]
#[serde(tag = "kind", content = "message")]
pub enum DbError {
    #[error("database pool error: {0}")]
    Pool(String),
    #[error("database query error: {0}")]
    Query(String),
    #[error("background database task panicked or was cancelled")]
    TaskJoin,
}

impl From<r2d2::Error> for DbError {
    fn from(e: r2d2::Error) -> Self {
        DbError::Pool(e.to_string())
    }
}

impl From<rusqlite::Error> for DbError {
    fn from(e: rusqlite::Error) -> Self {
        DbError::Query(e.to_string())
    }
}

/// Wraps a pooled SQLite connection and runs migrations on construction.
#[derive(Clone)]
pub struct Db {
    pool: SqlitePool,
}

impl Db {
    pub fn open(path: &Path) -> Result<Self, DbError> {
        let manager = SqliteConnectionManager::file(path).with_init(|conn| {
            conn.pragma_update(None, "foreign_keys", true)?;
            conn.pragma_update(None, "journal_mode", "WAL")?;
            Ok(())
        });
        let pool = Pool::new(manager)?;
        let mut conn = pool.get()?;
        migrations::run(&mut conn)?;
        Ok(Db { pool })
    }

    #[cfg(test)]
    pub fn open_for_test(path: &Path) -> Result<Self, DbError> {
        Self::open(path)
    }

    pub fn pool(&self) -> SqlitePool {
        self.pool.clone()
    }

    /// Runs a synchronous rusqlite closure on the blocking thread pool, per
    /// the architecture contract ("rusqlite's synchronous API run through
    /// tauri::async_runtime::spawn_blocking"). Commands should always go
    /// through this rather than calling the pool directly on the async
    /// runtime.
    pub async fn run_blocking<F, T>(&self, f: F) -> Result<T, DbError>
    where
        F: FnOnce(&rusqlite::Connection) -> Result<T, DbError> + Send + 'static,
        T: Send + 'static,
    {
        let pool = self.pool.clone();
        tauri::async_runtime::spawn_blocking(move || {
            let conn = pool.get()?;
            f(&conn)
        })
        .await
        .map_err(|_| DbError::TaskJoin)?
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn open_runs_migrations_and_run_blocking_round_trips_through_the_pool() {
        let file = tempfile::NamedTempFile::new().unwrap();
        let db = Db::open_for_test(file.path()).unwrap();

        let apps = db
            .run_blocking(repository::list_distracting_apps)
            .await
            .unwrap();
        assert!(apps.is_empty());

        db.run_blocking(|conn| repository::add_distracting_app(conn, "Twitter"))
            .await
            .unwrap();

        let apps = db
            .run_blocking(repository::list_distracting_apps)
            .await
            .unwrap();
        assert_eq!(apps, vec!["Twitter".to_string()]);
    }
}
