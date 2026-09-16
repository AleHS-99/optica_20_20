import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import Swal from "sweetalert2";


export default function VentasReport(){
    const [desde, setDesde] = useState(new Date().toISOString());
    const [hasta, setHasta] = useState(new Date().toISOString());
}