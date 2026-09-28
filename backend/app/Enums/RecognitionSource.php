<?php

namespace App\Enums;

enum RecognitionSource: string
{
    case Photo = 'photo';
    case Voice = 'voice';
}
