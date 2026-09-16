// tests/setup/happydom.ts
// happy-domの登録は他のimportより先に完了させる必要がある。
// 同一ファイルにtesting-library系のimportを混ぜると、ESモジュールの
// import巻き上げにより GlobalRegistrator.register() 実行前にそれらが
// 評価され、@testing-library/dom の screen が document なしの状態で
// 固定されてしまう。そのため登録処理をこのファイルだけに分離している。
import { GlobalRegistrator } from "@happy-dom/global-registrator";

GlobalRegistrator.register();
