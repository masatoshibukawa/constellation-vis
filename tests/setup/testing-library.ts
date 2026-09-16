// tests/setup/testing-library.ts
// happydom.ts が document を登録し終えたあとにロードされる前提のファイル。
// bunfig.toml の preload 配列で happydom.ts より後ろに置くこと。
import "@testing-library/jest-dom";
import { afterEach } from "bun:test";
import { cleanup } from "@testing-library/react";

afterEach(cleanup);
