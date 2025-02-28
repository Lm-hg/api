import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabase = createClient("https://iepzeymkgxspmtfnxosl.supabase.co", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImllcHpleW1rZ3hzcG10Zm54b3NsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDA2NTM1OTgsImV4cCI6MjA1NjIyOTU5OH0.JmBNbnH-sEcioIFYQOa1nWJB8vpwuvleLnFro0TP5q0");

export default supabase;
