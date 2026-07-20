#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod runtime;

fn main() {
    runtime::app::run();
}
