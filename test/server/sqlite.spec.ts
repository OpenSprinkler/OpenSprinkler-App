// test/server/sqlite.spec.ts
import { SqliteStorageProvider } from "../../server/storage/sqlite";
import { runStorageContract } from "./storage.contract";

runStorageContract( "sqlite (in-memory)", () => new SqliteStorageProvider( ":memory:" ) );
