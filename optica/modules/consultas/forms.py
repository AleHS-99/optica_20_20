from django.forms import *
from .models import consultaModel

class consultaForm(ModelForm):
    class Meta:
        model = consultaModel
        exclude = ['paciente'] 
        widgets = {
            'refraccion': TextInput(attrs={'class': 'form-control', 'placeholder': 'Ej: -2.00 -1.00 x180'}),
            'ojo_derecho': TextInput(attrs={'class': 'form-control', 'placeholder': 'Datos del ojo derecho'}),
            'ojo_izquierdo': TextInput(attrs={'class': 'form-control', 'placeholder': 'Datos del ojo izquierdo'}),
            'add': TextInput(attrs={'class': 'form-control', 'placeholder': 'Ej: +2.00'}),
            'galenos': TextInput(attrs={'class': 'form-control', 'placeholder': 'Prescripción médica'}),
            'corta_y_monta': TextInput(attrs={'class': 'form-control', 'placeholder': 'Indicaciones de corta y monta'}),
            'observaciones': Textarea(attrs={'class': 'form-control', 'rows': 2, 'placeholder': 'Observaciones adicionales'}),
        }
        