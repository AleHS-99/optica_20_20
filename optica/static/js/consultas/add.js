// static/js/consultas/add.js
$(function () {
    // Variables globales
    let pacienteId = null;
    let pacienteExiste = false;
    let dataTable = null;
    
    // ============ INICIALIZACIÓN ============
    
    function initDataTable() {
        if (dataTable) {
            dataTable.destroy();
        }
        
        dataTable = $('#data').DataTable({
            responsive: true,
            autoWidth: false,
            destroy: true,
            deferRender: true,
            processing: true,
            serverSide: false,
            ajax: {
                url: window.location.pathname,
                type: 'POST',
                data: function(d) {
                    d.action = 'searchdata';
                    d.paciente_id = pacienteId;
                    d.csrfmiddlewaretoken = '{{ csrf_token }}';
                },
                dataSrc: function(json) {
                    if (json.error) {
                        console.error(json.error);
                        return [];
                    }
                    return json.data || [];
                }
            },
            columns: [
                {
                    data: "created",
                    render: function(data) {
                        if (!data) return '-';
                        const date = new Date(data);
                        return date.toLocaleString('es-CU', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                        });
                    }
                },
                {"data": "refraccion", "defaultContent": "-"},
                {"data": "ojo_derecho", "defaultContent": "-"},
                {"data": "ojo_izquierdo", "defaultContent": "-"},
                {"data": "add", "defaultContent": "-"},
                {
                    "data": null,
                    class: 'text-center',
                    orderable: false,
                    render: function(data, type, row) {
                        let buttons = '';
                        const esHoy = row.es_hoy || false;
                        const esUltima = row.es_ultima || false;
                        const isFirst = row.is_first || false;
                        
                        // Botón Ver (siempre visible)
                        buttons += `<button class="btn btn-info btn-xs btn-flat ver-consulta" data-id="${row.id}">
                            <i class="fas fa-eye"></i>
                        </button> `;
                        
                        // Botón Editar (solo si es del día actual)
                        if (esHoy && esUltima) {
                            buttons += `<button class="btn btn-warning btn-xs btn-flat editar-consulta" data-id="${row.id}">
                                <i class="fas fa-edit"></i>
                            </button> `;
                        }
                        
                        // Botón Eliminar (solo si es del día actual y última)
                        if (esHoy && esUltima) {
                            buttons += `<button class="btn btn-danger btn-xs btn-flat eliminar-consulta" data-id="${row.id}">
                                <i class="fas fa-trash-alt"></i>
                            </button>`;
                        }
                        
                        return buttons || '<span class="text-muted">-</span>';
                    }
                }
            ],
            language: {
                url: "/static/spanish.json",
                processing: '<i class="fas fa-spinner fa-spin"></i> Cargando...'
            },
            order: [[0, 'desc']],
            pageLength: 5,
            lengthChange: false,
            info: true,
            autoWidth: false
        });
    }
    
    // ============ FUNCIONES DE CI ============
    
    function verificarCI(ci) {
        if (!ci || ci.length < 11) {
            limpiarEstadoCI();
            return;
        }
        
        mostrarLoadingCI();
        
        $.ajax({
            url: window.location.pathname,
            method: 'POST',
            data: {
                action: 'verificar_ci',
                ci: ci,
                csrfmiddlewaretoken: getCSRFToken()
            },
            success: function(response) {
                ocultarLoadingCI();
                
                if (response.exists) {
                    pacienteExiste = true;
                    pacienteId = response.paciente.id;
                    mostrarCIValido(response.paciente);
                    rellenarDatosPaciente(response.paciente);
                    mostrarConsultas(response.paciente.id);
                    $('#btn-nueva-consulta').prop('disabled', false);
                    
                    // Mostrar alerta de paciente encontrado
                    Swal.fire({
                        title: 'Paciente encontrado',
                        text: `${response.paciente.nombre} ${response.paciente.apell1} ${response.paciente.apell2}`,
                        icon: 'success',
                        timer: 1500,
                        showConfirmButton: false
                    });
                } else {
                    pacienteExiste = false;
                    pacienteId = null;
                    mostrarCIInvalido();
                    limpiarDatosPaciente(false);
                    ocultarConsultas();
                    $('#btn-nueva-consulta').prop('disabled', true);
                }
            },
            error: function(xhr) {
                ocultarLoadingCI();
                mostrarErrorCI();
                console.error('Error al verificar CI:', xhr.responseText);
            }
        });
    }
    
    function getCSRFToken() {
        return $('input[name="csrfmiddlewaretoken"]').val();
    }
    
    function mostrarLoadingCI() {
        $('#id_ci').addClass('ci-loading').removeClass('ci-valid ci-invalid');
        $('#ci-status').html('<i class="fas fa-spinner fa-spin text-warning"></i> Verificando...');
    }
    
    function ocultarLoadingCI() {
        $('#id_ci').removeClass('ci-loading');
    }
    
    function mostrarCIValido(paciente) {
        $('#id_ci').addClass('ci-valid').removeClass('ci-invalid');
        $('#ci-status').html(`<i class="fas fa-check-circle text-success"></i> Paciente: ${paciente.nombre}`);
    }
    
    function mostrarCIInvalido() {
        $('#id_ci').addClass('ci-invalid').removeClass('ci-valid');
        $('#ci-status').html('<i class="fas fa-times-circle text-danger"></i> Paciente no encontrado');
    }
    
    function mostrarErrorCI() {
        $('#id_ci').removeClass('ci-valid ci-invalid');
        $('#ci-status').html('<i class="fas fa-exclamation-circle text-danger"></i> Error al verificar');
    }
    
    function limpiarEstadoCI() {
        $('#id_ci').removeClass('ci-valid ci-invalid ci-loading');
        $('#ci-status').html('');
    }
    
    // ============ FUNCIONES DE PACIENTE ============
    
    function rellenarDatosPaciente(paciente) {
        $('#id_nombre').val(paciente.nombre).prop('readonly', true);
        $('#id_apell1').val(paciente.apell1).prop('readonly', true);
        $('#id_apell2').val(paciente.apell2).prop('readonly', true);
        $('#id_telefono').val(paciente.telefono || '').prop('readonly', true);
        $('#id_direccion').val(paciente.direccion || '').prop('readonly', true);
        $('#paciente-id').val(paciente.id);
        $('#consulta-paciente-id').val(paciente.id);
    }
    
    function limpiarDatosPaciente(limpiarCI = true) {
        if (limpiarCI) {
            $('#id_ci').val('').removeClass('ci-valid ci-invalid');
            $('#ci-status').html('');
        }
        $('#id_nombre').val('').prop('readonly', false);
        $('#id_apell1').val('').prop('readonly', false);
        $('#id_apell2').val('').prop('readonly', false);
        $('#id_telefono').val('').prop('readonly', false);
        $('#id_direccion').val('').prop('readonly', false);
        $('#paciente-id').val('');
        $('#consulta-paciente-id').val('');
    }
    
    function mostrarConsultas(pacienteId) {
        if (!pacienteId) {
            ocultarConsultas();
            return;
        }
        
        $('#card-consultas').show();
        if (dataTable) {
            dataTable.ajax.reload();
        } else {
            initDataTable();
        }
    }
    
    function ocultarConsultas() {
        $('#card-consultas').hide();
        if (dataTable) {
            dataTable.clear().draw();
        }
    }
    
    // ============ GUARDAR PACIENTE ============
    
    function guardarPaciente() {
        const ci = $('#id_ci').val().trim();
        if (!ci || ci.length !== 11) {
            Swal.fire('Error', 'El CI debe tener 11 dígitos', 'error');
            return;
        }
        
        // Verificar que los campos obligatorios estén llenos
        const nombre = $('#id_nombre').val().trim();
        const apell1 = $('#id_apell1').val().trim();
        if (!nombre || !apell1) {
            Swal.fire('Error', 'Nombre y primer apellido son obligatorios', 'error');
            return;
        }
        
        const formData = new FormData($('#PacienteForm')[0]);
        formData.append('action', 'guardar_paciente');
        
        Swal.fire({
            title: 'Guardando paciente...',
            text: 'Por favor espere',
            allowOutsideClick: false,
            allowEscapeKey: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });
        
        $.ajax({
            url: window.location.pathname,
            method: 'POST',
            data: formData,
            processData: false,
            contentType: false,
            success: function(response) {
                Swal.close();
                
                if (response.success) {
                    pacienteId = response.paciente_id;
                    pacienteExiste = true;
                    Swal.fire({
                        title: '¡Éxito!',
                        text: response.message || 'Paciente guardado correctamente',
                        icon: 'success',
                        timer: 1500,
                        showConfirmButton: false
                    });
                    
                    // Recargar datos
                    verificarCI($('#id_ci').val());
                } else {
                    let errorMsg = 'Error al guardar paciente';
                    if (response.errors) {
                        errorMsg = Object.values(response.errors).join('\n');
                    }
                    Swal.fire('Error', errorMsg, 'error');
                }
            },
            error: function(xhr) {
                Swal.close();
                Swal.fire('Error', 'Error en el servidor', 'error');
                console.error('Error:', xhr.responseText);
            }
        });
    }
    
    // ============ GUARDAR CONSULTA ============
    
    function guardarConsulta() {
        if (!pacienteId) {
            Swal.fire('Error', 'Primero debe guardar o seleccionar un paciente', 'error');
            return;
        }
        
        const formData = new FormData($('#ConsultaForm')[0]);
        formData.append('action', 'guardar_consulta');
        formData.append('paciente_id', pacienteId);
        
        Swal.fire({
            title: 'Guardando consulta...',
            text: 'Por favor espere',
            allowOutsideClick: false,
            allowEscapeKey: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });
        
        $.ajax({
            url: window.location.pathname,
            method: 'POST',
            data: formData,
            processData: false,
            contentType: false,
            success: function(response) {
                Swal.close();
                
                if (response.success) {
                    Swal.fire({
                        title: '¡Éxito!',
                        text: response.message || 'Consulta guardada correctamente',
                        icon: 'success',
                        timer: 1500,
                        showConfirmButton: false
                    });
                    
                    // Ocultar formulario de consulta
                    $('#card-consulta-form').hide();
                    $('#btn-nueva-consulta').show();
                    
                    // Recargar datatable
                    if (dataTable) {
                        dataTable.ajax.reload();
                    }
                    
                    // Limpiar formulario de consulta
                    $('#ConsultaForm')[0].reset();
                } else {
                    let errorMsg = 'Error al guardar consulta';
                    if (response.errors) {
                        errorMsg = Object.values(response.errors).join('\n');
                    }
                    Swal.fire('Error', errorMsg, 'error');
                }
            },
            error: function(xhr) {
                Swal.close();
                Swal.fire('Error', 'Error en el servidor', 'error');
                console.error('Error:', xhr.responseText);
            }
        });
    }
    
    // ============ ELIMINAR CONSULTA ============
    
    function eliminarConsulta(consultaId) {
        Swal.fire({
            title: '¿Eliminar consulta?',
            text: 'Esta acción no se puede deshacer',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Sí, eliminar',
            cancelButtonText: 'Cancelar'
        }).then((result) => {
            if (result.isConfirmed) {
                $.ajax({
                    url: window.location.pathname,
                    method: 'POST',
                    data: {
                        action: 'eliminar_consulta',
                        consulta_id: consultaId,
                        csrfmiddlewaretoken: getCSRFToken()
                    },
                    success: function(response) {
                        if (response.success) {
                            Swal.fire('Eliminado', response.message, 'success');
                            if (dataTable) {
                                dataTable.ajax.reload();
                            }
                        } else {
                            Swal.fire('Error', response.error || 'No se pudo eliminar', 'error');
                        }
                    },
                    error: function(xhr) {
                        Swal.fire('Error', 'Error al eliminar', 'error');
                        console.error('Error:', xhr.responseText);
                    }
                });
            }
        });
    }
    
    // ============ EVENTOS ============
    
    // Verificar CI al perder el foco o al presionar Enter
    $('#id_ci').on('blur', function() {
        const ci = $(this).val().trim();
        verificarCI(ci);
    });
    
    $('#id_ci').on('keypress', function(e) {
        if (e.which === 13) {
            e.preventDefault();
            const ci = $(this).val().trim();
            verificarCI(ci);
        }
    });
    
    $('#id_ci').on('input', function() {
        const ci = $(this).val().trim();
        if (ci.length < 11) {
            limpiarEstadoCI();
            pacienteExiste = false;
            pacienteId = null;
            limpiarDatosPaciente(false);
            ocultarConsultas();
            $('#btn-nueva-consulta').prop('disabled', true);
        }
    });
    
    // Botón guardar paciente
    $('#btn-guardar-paciente').on('click', function() {
        guardarPaciente();
    });
    
    // Botón limpiar
    $('#btn-limpiar-paciente').on('click', function() {
        limpiarDatosPaciente(true);
        ocultarConsultas();
        $('#btn-nueva-consulta').prop('disabled', true);
        pacienteExiste = false;
        pacienteId = null;
    });
    
    // Botón nueva consulta
    $('#btn-nueva-consulta').on('click', function() {
        if (!pacienteId) {
            Swal.fire('Error', 'Seleccione un paciente primero', 'error');
            return;
        }
        
        // Verificar si el paciente existe o es nuevo
        if (!pacienteExiste) {
            // Paciente nuevo, guardar primero
            Swal.fire({
                title: 'Guardando paciente...',
                text: 'Se guardará el paciente antes de crear la consulta',
                icon: 'info',
                showCancelButton: true,
                confirmButtonText: 'Guardar y continuar',
                cancelButtonText: 'Cancelar'
            }).then((result) => {
                if (result.isConfirmed) {
                    guardarPaciente();
                }
            });
            return;
        }
        
        // Paciente existe, mostrar formulario de consulta
        $('#card-consulta-form').show();
        $('#btn-nueva-consulta').hide();
        
        // Desplazar suavemente al formulario
        $('html, body').animate({
            scrollTop: $('#card-consulta-form').offset().top - 100
        }, 500);
    });
    
    // Botón guardar consulta
    $('#btn-guardar-consulta').on('click', function() {
        guardarConsulta();
    });
    
    // Botón cancelar consulta
    $('#btn-cancelar-consulta').on('click', function() {
        $('#card-consulta-form').hide();
        $('#btn-nueva-consulta').show();
        $('#ConsultaForm')[0].reset();
    });
    
    // Eventos delegados para botones en DataTable
    $(document).on('click', '.ver-consulta', function() {
        const consultaId = $(this).data('id');
        // Implementar modal o redirección para ver detalle
        Swal.fire({
            title: 'Detalle de Consulta',
            text: `Consulta #${consultaId} - Implementar vista detallada`,
            icon: 'info'
        });
    });
    
    $(document).on('click', '.editar-consulta', function() {
        const consultaId = $(this).data('id');
        // Implementar edición
        Swal.fire({
            title: 'Editar Consulta',
            text: `Editar consulta #${consultaId} - Implementar edición`,
            icon: 'info'
        });
    });
    
    $(document).on('click', '.eliminar-consulta', function() {
        const consultaId = $(this).data('id');
        eliminarConsulta(consultaId);
    });
    
    // ============ INICIALIZACIÓN ============
    
    // Inicializar DataTable oculto
    ocultarConsultas();
    $('#btn-nueva-consulta').prop('disabled', true);
    $('#card-consulta-form').hide();
    
    console.log('Add Consulta JS inicializado');
});