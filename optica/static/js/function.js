function message_error(obj) {
    var html = '';
    if (typeof (obj) === 'object') {
        html = '<ul style="text-align: left;">';
        $.each(obj, function (key, value) {
            html += '<li>' + key + ': ' + value + '</li>';
        });
        html += '</ul>';
    } else {
        html = '<p>' + obj + '</p>';
    }
    Swal.fire({
        title: 'Error!',
        html: html,
        icon: 'error'
    });
}

function submit_with_ajax(url, title, content, parameters, callback) {
    // Mostrar SweetAlert de carga
    Swal.fire({
        title: 'Procesando',
        html: content,
        allowOutsideClick: false,
        showConfirmButton: false,
        willOpen: () => {
            Swal.showLoading();
        }
    });

    $.ajax({
        url: url,
        type: 'POST',
        data: parameters,
        dataType: 'json',
        processData: false,
        contentType: false,
    }).done(function (data) {

        if (!data.hasOwnProperty('error')) {
            // Cerrar el SweetAlert de carga
            Swal.close();
            
            callback(data);
            return false;
        }
        // Mostrar error si existe
        message_error(data.error)

    }).fail(function (jqXHR, textStatus, errorThrown) {
        message_error(errorThrown)

    });
}

function alert_action(title, content, callback, cancel) {
    $.confirm({
        theme: 'material',
        title: title,
        icon: 'fa fa-info',
        content: content,
        columnClass: 'small',
        typeAnimated: true,
        cancelButtonClass: 'btn-primary',
        draggable: true,
        dragWindowBorder: false,
        buttons: {
            info: {
                text: "Si",
                btnClass: 'btn-primary',
                action: function () {
                    callback();
                }
            },
            danger: {
                text: "No",
                btnClass: 'btn-red',
                action: function () {
                    cancel();
                }
            },
        }
    })
}